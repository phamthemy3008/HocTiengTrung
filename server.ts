import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { extractVocabularyFromImage, evaluatePronunciation, checkHandwritingMatch } from './api/gemini';
import { getSystemDecksAndCards, saveSystemVocab, resetSystemVocabToDefault } from './api/systemDecks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = 'phamthemy3008@gmail.com';

app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In-memory cache for high-speed TTS responses
const ttsCache = new Map<string, { buffer: Buffer; mimeType: string }>();

// High-definition Native Mandarin TTS Audio Endpoint (Same-origin, 100% reliable across all browsers & iOS)
app.get('/api/tts', async (req, res) => {
  const text = ((req.query.text as string) || '').trim();
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  const cacheKey = text.toLowerCase();
  let audioData: { buffer: Buffer; mimeType: string } | null = null;

  if (ttsCache.has(cacheKey)) {
    audioData = ttsCache.get(cacheKey)!;
  } else {
    const urls = [
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(text)}`,
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            Referer: 'https://translate.google.com/',
          },
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = response.headers.get('content-type') || 'audio/mpeg';

          audioData = { buffer, mimeType };

          if (ttsCache.size > 1000) {
            const firstKey = ttsCache.keys().next().value;
            if (firstKey) ttsCache.delete(firstKey);
          }
          ttsCache.set(cacheKey, audioData);
          break;
        }
      } catch (e) {
        console.warn(`TTS source failed for "${text}":`, url, e);
      }
    }
  }

  if (!audioData) {
    return res.status(502).send('Unable to generate TTS audio');
  }

  const { buffer, mimeType } = audioData;
  const totalLength = buffer.length;

  // Handle Range request for iOS Safari WebKit audio player
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalLength}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    return res.end(buffer.subarray(start, end + 1));
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', totalLength);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  return res.send(buffer);
});

// Handwriting stroke match check
app.post('/api/check-handwriting', async (req, res) => {
  try {
    const { imageBase64, targetHanzi, targetPinyin, meaning } = req.body;
    if (!imageBase64 || !targetHanzi) {
      return res.status(400).json({ error: 'Missing imageBase64 or targetHanzi' });
    }
    const result = await checkHandwritingMatch(imageBase64, targetHanzi, targetPinyin || '', meaning || '');
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Handwriting check error:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi kiểm tra nét viết' });
  }
});

// OCR Vocabulary extraction from image
app.post('/api/ocr-vocab', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }
    const words = await extractVocabularyFromImage(imageBase64, mimeType || 'image/jpeg');
    res.json({ success: true, words });
  } catch (err: any) {
    console.error('OCR Error:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi nhận diện từ vựng qua ảnh' });
  }
});

// Pronunciation evaluation (Accepts text transcript, direct audio recording, or both)
app.post('/api/evaluate-pronunciation', async (req, res) => {
  try {
    const { targetHanzi, targetPinyin, recognizedText, audioBase64, audioMimeType } = req.body;
    if (!targetHanzi) {
      return res.status(400).json({ error: 'Missing targetHanzi' });
    }
    const evaluation = await evaluatePronunciation(
      targetHanzi,
      targetPinyin || '',
      recognizedText || '',
      audioBase64,
      audioMimeType || 'audio/webm'
    );
    res.json({ success: true, evaluation });
  } catch (err: any) {
    console.error('Pronunciation Evaluation Error:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi đánh giá phát âm' });
  }
});

// System default vocabulary endpoints (Admin protected)
app.get('/api/system-vocab', (req, res) => {
  const data = getSystemDecksAndCards();
  res.json({ success: true, ...data });
});

app.post('/api/system-vocab', (req, res) => {
  try {
    const adminEmail = (req.headers['x-admin-email'] || req.headers['authorization']) as string;
    const cleanEmail = adminEmail ? adminEmail.replace('Bearer ', '').trim().toLowerCase() : '';
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Chỉ tài khoản Quản trị viên (${ADMIN_EMAIL}) mới có quyền sửa đổi bộ từ hệ thống.`,
      });
    }
    const { decks, cards } = req.body;
    const result = saveSystemVocab(decks, cards);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-vocab/reset', (req, res) => {
  try {
    const adminEmail = (req.headers['x-admin-email'] || req.headers['authorization']) as string;
    const cleanEmail = adminEmail ? adminEmail.replace('Bearer ', '').trim().toLowerCase() : '';
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Chỉ tài khoản Quản trị viên (${ADMIN_EMAIL}) mới có quyền khôi phục bộ từ gốc.`,
      });
    }
    const result = resetSystemVocabToDefault();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback in-memory & file store for backup
const FEEDBACK_FILE = path.resolve(process.cwd(), 'src/data/userFeedback.json');
let feedbacks: any[] = [];
try {
  if (fs.existsSync(FEEDBACK_FILE)) {
    feedbacks = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
  }
} catch {}

function saveFeedbacksToFile() {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2), 'utf-8');
  } catch {}
}

app.get('/api/feedback', (_req, res) => {
  res.json({ success: true, feedbacks });
});

app.post('/api/feedback', (req, res) => {
  const item = req.body;
  if (!item || !item.message) {
    return res.status(400).json({ success: false, error: 'Thiếu nội dung góp ý' });
  }
  feedbacks.unshift(item);
  saveFeedbacksToFile();
  console.log(`📬 [GÓP Ý MỚI TỪ NGƯỜI DÙNG]: "${item.message.substring(0, 60)}..." (Người gửi: ${item.name || item.email || 'Ẩn danh'})`);
  res.json({ success: true, item });
});

app.patch('/api/feedback/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const idx = feedbacks.findIndex((f) => f.id === id);
  if (idx >= 0) {
    feedbacks[idx].status = status;
    saveFeedbacksToFile();
  }
  res.json({ success: true });
});

app.delete('/api/feedback/:id', (req, res) => {
  const { id } = req.params;
  feedbacks = feedbacks.filter((f) => f.id !== id);
  saveFeedbacksToFile();
  res.json({ success: true });
});

// Blacklist in-memory & file store
const BLACKLIST_FILE = path.resolve(process.cwd(), 'src/data/blacklist.json');
let blacklist: any[] = [];
try {
  if (fs.existsSync(BLACKLIST_FILE)) {
    blacklist = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'));
  }
} catch {}

function saveBlacklistToFile() {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2), 'utf-8');
  } catch {}
}

app.get('/api/blacklist', (_req, res) => {
  res.json({ success: true, blacklist });
});

app.post('/api/blacklist', (req, res) => {
  try {
    const adminEmail = (req.headers['x-admin-email'] || req.headers['authorization']) as string;
    const cleanEmail = adminEmail ? adminEmail.replace('Bearer ', '').trim().toLowerCase() : '';
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Chỉ tài khoản Quản trị viên (${ADMIN_EMAIL}) mới có quyền quản lý blacklist.`,
      });
    }
    const entry = req.body;
    if (!entry || !entry.email) {
      return res.status(400).json({ success: false, error: 'Thiếu email cần khóa' });
    }
    const existingIdx = blacklist.findIndex((b) => b.email.toLowerCase() === entry.email.toLowerCase());
    if (existingIdx >= 0) {
      blacklist[existingIdx] = entry;
    } else {
      blacklist.unshift(entry);
    }
    saveBlacklistToFile();
    console.log(`🚫 [BLACKLIST ADDED]: User ${entry.email} đã bị khóa.`);
    res.json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/blacklist/:emailOrId', (req, res) => {
  try {
    const adminEmail = (req.headers['x-admin-email'] || req.headers['authorization']) as string;
    const cleanEmail = adminEmail ? adminEmail.replace('Bearer ', '').trim().toLowerCase() : '';
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Chỉ tài khoản Quản trị viên (${ADMIN_EMAIL}) mới có quyền bỏ cấm user.`,
      });
    }
    const target = req.params.emailOrId.toLowerCase();
    blacklist = blacklist.filter((b) => b.id !== target && b.email.toLowerCase() !== target);
    saveBlacklistToFile();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
