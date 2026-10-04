import { Card } from '../types';

export interface ParseResult {
  success: boolean;
  cards: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[];
  error?: string;
}

/**
 * Parses raw text imported from Anki (TSV, TXT, CSV) or custom vocabulary lists
 */
export function parseAnkiOrText(content: string, deckId: string): ParseResult {
  if (!content || !content.trim()) {
    return { success: false, cards: [], error: 'Nội dung trống, vui lòng dán hoặc chọn file hợp lệ.' };
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const parsedCards: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines starting with #
    if (line.startsWith('#')) continue;

    let parts: string[] = [];

    // Check separator: Tab > Semicolon > Comma > Hyphen / Colon
    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim());
    } else if (line.includes(';') && !line.includes('&quot;')) {
      parts = line.split(';').map((p) => p.trim());
    } else if (line.includes(',')) {
      // Basic CSV splitting
      parts = parseCsvLine(line);
    } else if (line.includes(' - ')) {
      parts = line.split(' - ').map((p) => p.trim());
    } else if (line.includes(': ') || line.includes('：')) {
      parts = line.split(/: |：/).map((p) => p.trim());
    } else {
      // Single word or whitespace separated
      parts = line.split(/\s{2,}/).map((p) => p.trim());
    }

    if (parts.length >= 2) {
      const hanzi = cleanHtmlTags(parts[0]);
      let pinyin = '';
      let meaning = '';
      let exampleSentence = '';
      let exampleMeaning = '';

      if (parts.length === 2) {
        // [Hanzi, Meaning] or [Hanzi, Pinyin + Meaning]
        meaning = cleanHtmlTags(parts[1]);
      } else if (parts.length === 3) {
        // [Hanzi, Pinyin, Meaning]
        pinyin = cleanHtmlTags(parts[1]);
        meaning = cleanHtmlTags(parts[2]);
      } else if (parts.length >= 4) {
        // [Hanzi, Pinyin, Meaning, Example, ...]
        pinyin = cleanHtmlTags(parts[1]);
        meaning = cleanHtmlTags(parts[2]);
        exampleSentence = cleanHtmlTags(parts[3]);
        if (parts.length >= 5) {
          exampleMeaning = cleanHtmlTags(parts[4]);
        }
      }

      if (hanzi) {
        parsedCards.push({
          deckId,
          hanzi,
          pinyin,
          meaning,
          exampleSentence: exampleSentence || undefined,
          exampleMeaning: exampleMeaning || undefined,
          interval: 0,
          repetitions: 0,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
          status: 'new',
        });
      }
    }
  }

  if (parsedCards.length === 0) {
    return {
      success: false,
      cards: [],
      error: 'Không nhận diện được từ vựng hợp lệ. Hãy kiểm tra lại định dạng (ví dụ: Hán tự [Tab] Pinyin [Tab] Nghĩa).',
    };
  }

  return {
    success: true,
    cards: parsedCards,
  };
}

function cleanHtmlTags(str: string): string {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}
