import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { extractVocabularyFromImage, evaluatePronunciation, checkHandwritingMatch } from './api/gemini';
import { getSystemDecksAndCards, importSystemCards } from './api/systemDecks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// System default vocabulary endpoints
app.get('/api/system-vocab', (req, res) => {
  const data = getSystemDecksAndCards();
  res.json({ success: true, ...data });
});

app.post('/api/system-vocab', (req, res) => {
  try {
    const { decks, cards } = req.body;
    const result = importSystemCards(decks, cards);
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
