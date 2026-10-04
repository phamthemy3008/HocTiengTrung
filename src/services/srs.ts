import { Card, CardStatus, SRSRatingResult } from '../types';

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm Implementation
 * Quality ratings:
 * 1: Again (Quên hẳn / Nhớ sai)
 * 2: Hard (Nhớ rất khó khăn, ngập ngừng)
 * 3: Good (Nhớ đúng sau một chút suy nghĩ)
 * 4: Easy (Nhớ ngay lập tức, phản xạ tự nhiên)
 */
export function calculateSM2(card: Card, rating: 1 | 2 | 3 | 4): SRSRatingResult {
  const currentInterval = card.interval || 0;
  const currentRepetitions = card.repetitions || 0;
  let currentEF = card.easeFactor || 2.5;

  // Map 1-4 scale to SM-2 0-5 scale:
  // 1 -> 1 (Incorrect)
  // 2 -> 3 (Correct with serious difficulty)
  // 3 -> 4 (Correct after hesitation)
  // 4 -> 5 (Perfect recall)
  const qMap: Record<number, number> = {
    1: 1,
    2: 3,
    3: 4,
    4: 5,
  };
  const q = qMap[rating] || 3;

  // Calculate new Ease Factor (EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  currentEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (currentEF < 1.3) {
    currentEF = 1.3;
  }
  if (currentEF > 3.0) {
    currentEF = 3.0;
  }
  currentEF = Math.round(currentEF * 100) / 100;

  let newInterval = 1;
  let newRepetitions = 0;
  let newStatus: CardStatus = 'learning';

  if (rating === 1) {
    // Again: Lapse back to learning
    newRepetitions = 0;
    newInterval = 1;
    newStatus = 'learning';
  } else if (rating === 2) {
    // Hard: Minimal progression
    newRepetitions = Math.max(1, currentRepetitions);
    newInterval = Math.max(1, Math.round((currentInterval || 1) * 1.2));
    newStatus = newInterval >= 7 ? 'review' : 'learning';
  } else {
    // Good (3) or Easy (4)
    if (currentRepetitions === 0) {
      newInterval = 1;
    } else if (currentRepetitions === 1) {
      newInterval = rating === 4 ? 4 : 3;
    } else {
      const bonus = rating === 4 ? 1.3 : 1.0;
      newInterval = Math.max(1, Math.round(currentInterval * currentEF * bonus));
    }
    newRepetitions = currentRepetitions + 1;
    newStatus = newInterval >= 21 ? 'mastered' : 'review';
  }

  // Calculate due date (ISO string at midnight of due day)
  const now = new Date();
  const nextDueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: currentEF,
    dueDate: nextDueDate.toISOString(),
    status: newStatus,
  };
}

/**
 * Check if a card is currently due for review
 */
export function isCardDue(card: Card): boolean {
  if (!card.dueDate) return true;
  return new Date(card.dueDate).getTime() <= Date.now();
}

/**
 * Prioritize and sort cards strictly according to SuperMemo-2 (SM-2) principles:
 * - Tier 1: Overdue & Due cards (dueDate <= now, already learned) sorted by oldest due date
 * - Tier 2: Difficult / Learning cards (isWeak, mistakeCount > 0, status === 'learning')
 * - Tier 3: Brand new cards (repetitions === 0 or status === 'new')
 * - Tier 4: Future review cards (dueDate > now)
 */
export function sortCardsForSM2Queue(cards: Card[]): Card[] {
  const now = Date.now();

  const getTier = (card: Card): number => {
    const dueTime = card.dueDate ? new Date(card.dueDate).getTime() : 0;
    const isDue = dueTime <= now;

    if (isDue && (card.repetitions || 0) > 0) return 1; // Tier 1: Đến hạn ôn tập
    if (card.isWeak || card.status === 'learning' || (card.mistakeCount && card.mistakeCount > 0)) return 2; // Tier 2: Thẻ khó / đang học
    if (!card.repetitions || card.repetitions === 0 || card.status === 'new') return 3; // Tier 3: Thẻ mới
    return 4; // Tier 4: Thẻ chưa đến hạn
  };

  return [...cards].sort((a, b) => {
    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return dueA - dueB;
  });
}

/**
 * Format interval into human readable Vietnamese string
 */
export function formatInterval(days: number): string {
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  const months = Math.round(days / 30);
  return `${months} tháng`;
}
