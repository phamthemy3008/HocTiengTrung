import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, Plugin } from 'vite';
import {
  extractVocabularyFromImage,
  evaluatePronunciation,
  checkHandwritingMatch,
  generateSmartVocab,
} from './api/gemini';
import { getSystemDecksAndCards, importSystemCards } from './api/systemDecks';

dotenv.config();

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const readBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });
        };

        if (req.url === '/api/ocr-vocab' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { imageBase64, mimeType } = body;
            if (!imageBase64) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing imageBase64' }));
              return;
            }
            const words = await extractVocabularyFromImage(imageBase64, mimeType || 'image/jpeg');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, words }));
          } catch (err: any) {
            console.error('Vite API OCR error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Lỗi nhận diện ảnh' }));
          }
          return;
        }

        if (req.url === '/api/generate-vocab-smart' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { input, sourceLang } = body;
            if (!input || !input.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Vui lòng nhập từ hoặc cụm từ' }));
              return;
            }
            const vocab = await generateSmartVocab(input.trim(), sourceLang);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, vocab }));
          } catch (err: any) {
            console.error('Vite API Generate Smart Vocab error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Lỗi tạo từ vựng AI' }));
          }
          return;
        }

        if (req.url === '/api/evaluate-pronunciation' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { targetHanzi, targetPinyin, recognizedText, audioBase64, audioMimeType } = body;
            const evaluation = await evaluatePronunciation(
              targetHanzi,
              targetPinyin || '',
              recognizedText || '',
              audioBase64,
              audioMimeType || 'audio/webm'
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, evaluation }));
          } catch (err: any) {
            console.error('Vite API Pronunciation error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Lỗi đánh giá' }));
          }
          return;
        }

        if (req.url === '/api/check-handwriting' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { imageBase64, targetHanzi, targetPinyin, meaning } = body;
            const result = await checkHandwritingMatch(
              imageBase64,
              targetHanzi,
              targetPinyin || '',
              meaning || ''
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, result }));
          } catch (err: any) {
            console.error('Vite API Handwriting error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Lỗi kiểm tra nét viết' }));
          }
          return;
        }

        if (req.url === '/api/system-vocab' && req.method === 'GET') {
          const data = getSystemDecksAndCards();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...data }));
          return;
        }

        if (req.url === '/api/system-vocab' && req.method === 'POST') {
          try {
            const body = await readBody();
            const { decks, cards } = body;
            const result = importSystemCards(decks, cards);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url === '/api/system-vocab/reset' && req.method === 'POST') {
          try {
            const { resetSystemVocabToDefault } = await import('./api/systemDecks');
            const result = resetSystemVocabToDefault();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith('/api/feedback')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, feedbacks: [] }));
          return;
        }

        if (req.url?.startsWith('/api/blacklist')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, blacklist: [] }));
          return;
        }

        if (req.url?.startsWith('/api/tts') && req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const text = (urlObj.searchParams.get('text') || '').trim();
            if (!text) {
              res.statusCode = 400;
              res.end('Missing text parameter');
              return;
            }

            const urls = [
              `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`,
              `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(text)}`,
            ];

            let audioBuffer: Buffer | null = null;
            let mimeType = 'audio/mpeg';

            for (const u of urls) {
              try {
                const resp = await fetch(u, {
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    Referer: 'https://translate.google.com/',
                  },
                });
                if (resp.ok) {
                  const arr = await resp.arrayBuffer();
                  audioBuffer = Buffer.from(arr);
                  mimeType = resp.headers.get('content-type') || 'audio/mpeg';
                  break;
                }
              } catch (_) {}
            }

            if (!audioBuffer) {
              res.statusCode = 502;
              res.end('Unable to generate TTS');
              return;
            }

            const totalLength = audioBuffer.length;
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10) || 0;
              const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
              const chunksize = end - start + 1;

              res.statusCode = 206;
              res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Content-Length', chunksize);
              res.setHeader('Content-Type', mimeType);
              res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
              res.end(audioBuffer.subarray(start, end + 1));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', totalLength);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            res.end(audioBuffer);
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end('TTS server error: ' + (err?.message || 'unknown'));
            return;
          }
        }

        if (req.url === '/api/health') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
