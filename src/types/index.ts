export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

export type StudyMode = 'vietnamese_to_writing' | 'hanzi_to_meaning' | 'random';

export interface Card {
  id: string;
  deckId: string;
  userId: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  exampleSentence?: string;
  examplePinyin?: string;
  exampleMeaning?: string;
  tags?: string[];
  // SRS (SuperMemo-2) State
  interval: number; // days
  repetitions: number; // consecutive correct answers
  easeFactor: number; // default 2.5
  dueDate: string; // ISO string
  lastReviewed?: string;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  userId: string;
  title: string;
  description: string;
  color: string;
  cardCount: number;
  isPublic?: boolean;
  isSystem?: boolean; // Bộ từ vựng mặc định của hệ thống
  createdAt: string;
  updatedAt: string;
}

export interface StudyLog {
  id: string;
  userId: string;
  cardId: string;
  deckId: string;
  rating: number; // 1: Again, 2: Hard, 3: Good, 4: Easy
  mode: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  dailyGoal: number; // default 20
  streak: number;
  lastStudyDate: string; // YYYY-MM-DD
  totalCardsLearned: number;
  createdAt: string;
  updatedAt: string;
}

export interface SRSRatingResult {
  interval: number;
  repetitions: number;
  easeFactor: number;
  dueDate: string;
  status: CardStatus;
}

export interface OcrExtractedWord {
  hanzi: string;
  pinyin: string;
  meaning: string;
  exampleSentence?: string;
  examplePinyin?: string;
  exampleMeaning?: string;
}

export interface PronunciationEvaluation {
  accuracyScore: number; // 0-100
  recognizedText: string;
  toneFeedback: string;
  tips: string;
  isCorrect: boolean;
  mistakeDetail?: string; // Chỉ rõ điểm sai cụ thể
  correctionGuide?: string; // Hướng dẫn sửa chi tiết cách đọc
  phoneticBreakdown?: {
    initial?: string; // Thanh mẫu (phụ âm đầu)
    final?: string; // Vận mẫu (nguyên âm)
    toneName?: string; // Tên thanh điệu
  };
}

export interface FeedbackItem {
  id: string;
  name?: string;
  email?: string;
  category?: 'content' | 'bug' | 'feature' | 'other';
  message: string;
  status: 'unread' | 'read' | 'resolved';
  createdAt: string;
}

