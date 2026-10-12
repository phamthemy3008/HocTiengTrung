import { Card } from '../types';

/**
 * Bảng ánh xạ ký tự Pinyin có dấu thanh điệu sang nguyên âm không dấu
 */
const TONE_MAP: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ü: 'v', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v',
  ê: 'e', ń: 'n', ň: 'n',
  Ā: 'a', Á: 'a', Ǎ: 'a', À: 'a',
  Ē: 'e', É: 'e', Ě: 'e', È: 'e',
  Ī: 'i', Í: 'i', Ǐ: 'i', Ì: 'i',
  Ō: 'o', Ó: 'o', Ǒ: 'o', Ò: 'o',
  Ū: 'u', Ú: 'u', Ǔ: 'u', Ù: 'u',
  Ü: 'v', Ǖ: 'v', Ǘ: 'v', Ǚ: 'v', Ǜ: 'v',
};

/**
 * Loại bỏ toàn bộ dấu thanh điệu khỏi chuỗi Pinyin
 * Ví dụ: "Nǐ hǎo" -> "ni hao", "lǚxíng" -> "lvxing"
 */
export function removeToneMarks(pinyin: string): string {
  if (!pinyin) return '';
  let result = '';
  for (const char of pinyin) {
    if (TONE_MAP[char]) {
      result += TONE_MAP[char];
    } else {
      result += char;
    }
  }
  // Chuẩn hóa Unicode loại bỏ các dấu kết hợp (combining diacritical marks)
  return result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Chuẩn hóa chuỗi để so khớp:
 * - Chuyển chữ thường
 * - Thay thế ü bằng v
 * - Loại bỏ dấu cách thừa, dấu chấm phẩy, số thanh điệu (1-5)
 * Ví dụ: "Ni3 hao3!" -> "nihao", "nǐ hǎo" -> "nihao"
 */
export function cleanPinyinForStrictCompare(text: string): string {
  return removeToneMarks(text)
    .replace(/[1-5]/g, '') // Bỏ số thanh điệu nếu người dùng gõ ni3hao3
    .replace(/[^a-z]/g, '') // Chỉ giữ lại các chữ cái a-z
    .trim();
}

/**
 * Chuẩn hóa giữ dấu cách giữa các âm tiết:
 * Ví dụ: "Ni3  hao3" -> "ni hao"
 */
export function cleanPinyinWithSpaces(text: string): string {
  return removeToneMarks(text)
    .replace(/[1-5]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra xem dữ liệu người dùng gõ có khớp với Pinyin mục tiêu không
 * Hỗ trợ các trường hợp:
 * 1. Gõ có dấu chuẩn: "nǐ hǎo" === "nǐ hǎo"
 * 2. Gõ không dấu có cách hoặc dính liền: "ni hao" hoặc "nihao" khớp "nǐ hǎo"
 * 3. Gõ kèm số thanh điệu: "ni3hao3" hoặc "ni3 hao3" khớp "nǐ hǎo"
 * 4. Hỗ trợ biến thể phân tách bằng dấu gạch chéo (/ hoặc , hoặc ;)
 */
export function isPinyinMatch(
  userInput: string,
  targetPinyin: string
): { isMatch: boolean; isExactToneMatch: boolean; cleanInput: string } {
  const rawInput = (userInput || '').trim().toLowerCase();
  const rawTarget = (targetPinyin || '').trim().toLowerCase();

  if (!rawInput || !rawTarget) {
    return { isMatch: false, isExactToneMatch: false, cleanInput: '' };
  }

  // Tách các biến thể nếu thẻ có nhiều cách đọc (ví dụ: "dū / dōu")
  const targetVariants = rawTarget
    .split(/[/,;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const cleanInputExact = rawInput.replace(/\s+/g, ' ');
  const userLettersOnly = cleanPinyinForStrictCompare(rawInput);
  const userWithSpaces = cleanPinyinWithSpaces(rawInput);

  for (const variant of targetVariants) {
    // 1. Khớp chính xác cả dấu
    const cleanVariantExact = variant.replace(/\s+/g, ' ');
    if (cleanInputExact === cleanVariantExact) {
      return { isMatch: true, isExactToneMatch: true, cleanInput: userLettersOnly };
    }

    // 2. Khớp theo ký tự (không dấu hoặc có số)
    const variantLettersOnly = cleanPinyinForStrictCompare(variant);
    const variantWithSpaces = cleanPinyinWithSpaces(variant);

    if (
      userLettersOnly === variantLettersOnly ||
      userWithSpaces === variantWithSpaces
    ) {
      return { isMatch: true, isExactToneMatch: false, cleanInput: userLettersOnly };
    }
  }

  return {
    isMatch: false,
    isExactToneMatch: false,
    cleanInput: userLettersOnly,
  };
}

/**
 * Tạo chuỗi gợi ý âm tiết đầu: "nǐ hǎo" -> "n... h..."
 */
export function formatPinyinInitialHint(pinyin: string): string {
  if (!pinyin) return '';
  return pinyin
    .trim()
    .split(/\s+/)
    .map((word) => {
      const cleanWord = removeToneMarks(word);
      const firstChar = cleanWord[0] || word[0] || '';
      return `${firstChar}...`;
    })
    .join(' ');
}

export interface ImeCandidate {
  hanzi: string;
  pinyin?: string;
  isCorrect: boolean;
}

/**
 * Tạo danh sách 3 - 4 chữ Hán ứng viên mô phỏng bộ gõ IME (Sogou / Gboard / Apple IME)
 * Chữ Hán đúng sẽ được bố trí ở một vị trí ngẫu nhiên (1-3) cùng các phương án gây nhiễu
 */
export function generateImeCandidates(
  targetCard: { hanzi: string; pinyin: string },
  allCards: Card[]
): ImeCandidate[] {
  const targetHanzi = targetCard.hanzi.trim();
  const targetPinyinClean = cleanPinyinForStrictCompare(targetCard.pinyin);

  // Tìm các từ có cùng độ dài hoặc cùng pinyin âm tiết từ kho thẻ hiện có
  const sameLengthCards = allCards.filter(
    (c) => c.hanzi.trim() !== targetHanzi && c.hanzi.trim().length === targetHanzi.length
  );

  // Ưu tiên các từ có pinyin tương tự (đồng âm) nếu có
  const homophones = sameLengthCards.filter(
    (c) => cleanPinyinForStrictCompare(c.pinyin) === targetPinyinClean
  );

  // Danh sách các từ gây nhiễu
  const distractors: Card[] = [];

  // Lấy tối đa 2 từ đồng âm
  homophones.slice(0, 2).forEach((c) => distractors.push(c));

  // Nếu chưa đủ 3 từ gây nhiễu, lấy thêm các từ cùng độ dài khác
  for (const card of sameLengthCards) {
    if (distractors.length >= 3) break;
    if (!distractors.some((d) => d.hanzi === card.hanzi)) {
      distractors.push(card);
    }
  }

  // Nếu vẫn chưa đủ, lấy bất kỳ từ nào khác
  if (distractors.length < 2) {
    for (const card of allCards) {
      if (distractors.length >= 3) break;
      if (card.hanzi.trim() !== targetHanzi && !distractors.some((d) => d.hanzi === card.hanzi)) {
        distractors.push(card);
      }
    }
  }

  // Tạo danh sách ứng viên
  const candidates: ImeCandidate[] = [
    { hanzi: targetHanzi, pinyin: targetCard.pinyin, isCorrect: true },
    ...distractors.slice(0, 3).map((d) => ({
      hanzi: d.hanzi.trim(),
      pinyin: d.pinyin,
      isCorrect: false,
    })),
  ];

  // Trộn thứ tự ngẫu nhiên nhẹ nhàng (nhưng ưu tiên đúng ở top 1-3)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}

/**
 * Bộ ký tự thanh điệu nhanh cho bàn phím ảo trên điện thoại di động
 */
export const MOBILE_TONE_BUTTONS = [
  { tone: '1', chars: ['ā', 'ē', 'ī', 'ō', 'ū', 'ǖ'] },
  { tone: '2', chars: ['á', 'é', 'í', 'ó', 'ú', 'ǘ'] },
  { tone: '3', chars: ['ǎ', 'ě', 'ǐ', 'ǒ', 'ǔ', 'ǚ'] },
  { tone: '4', chars: ['à', 'è', 'ì', 'ò', 'ù', 'ǜ'] },
];
