import express from 'express';
import path from 'path';
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

// Pronunciation evaluation
app.post('/api/evaluate-pronunciation', async (req, res) => {
  try {
    const { targetHanzi, targetPinyin, recognizedText } = req.body;
    if (!targetHanzi) {
      return res.status(400).json({ error: 'Missing targetHanzi' });
    }
    const evaluation = await evaluatePronunciation(targetHanzi, targetPinyin || '', recognizedText || '');
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

// Serve frontend in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
