import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  Mic,
  MicOff,
  RotateCw,
  Sparkles,
  Shuffle,
  PenTool,
  BookA,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  Tag,
  Lightbulb,
} from 'lucide-react';
import { Card, Deck, StudyMode, PronunciationEvaluation } from '../types';
import { HanziCanvas } from './HanziCanvas';
import { speechService } from '../services/speech';
import { formatInterval } from '../services/srs';

interface StudySessionProps {
  cards: Card[];
  decks: Deck[];
  currentDeckId: string;
  setCurrentDeckId: (id: string) => void;
  onRecordReview: (card: Card, rating: 1 | 2 | 3 | 4, mode: string) => Promise<void>;
  onNavigateToDecks: () => void;
}

export const StudySession: React.FC<StudySessionProps> = ({
  cards,
  decks,
  currentDeckId,
  setCurrentDeckId,
  onRecordReview,
  onNavigateToDecks,
}) => {
  const currentDeckSelectId = useId();
  const studyModeSelectId = useId();

  // Selected Tags for filtering study session (multi-selection)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Base cards in the selected deck
  const baseDeckCards = useMemo(() => {
    if (currentDeckId === 'all') return cards;
    return cards.filter((c) => c.deckId === currentDeckId);
  }, [cards, currentDeckId]);

  // All distinct tags available in the current deck (or all decks) with count
  const availableTags = useMemo(() => {
    const map = new Map<string, number>();
    baseDeckCards.forEach((c) => {
      if (c.tags && Array.isArray(c.tags)) {
        c.tags.forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) {
            map.set(trimmed, (map.get(trimmed) || 0) + 1);
          }
        });
      }
    });
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'vi', { numeric: true }));
  }, [baseDeckCards]);

  // Toggle a tag in multi-selection
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleClearTags = () => {
    setSelectedTags([]);
  };

  // Filter cards by deck AND selected tags
  const deckCards = useMemo(() => {
    if (selectedTags.length === 0) return baseDeckCards;
    return baseDeckCards.filter((c) => {
      if (!c.tags || c.tags.length === 0) return false;
      return selectedTags.some((selectedTag) => c.tags?.includes(selectedTag));
    });
  }, [baseDeckCards, selectedTags]);

  // Queue of cards to study in this session
  const [studyQueue, setStudyQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showWritingHint, setShowWritingHint] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<StudyMode>('random');
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);

  // Pronunciation check states
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micTranscript, setMicTranscript] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<PronunciationEvaluation | null>(null);
  const [voiceRecorder, setVoiceRecorder] = useState<{ stop: () => void } | null>(null);
  const micTranscriptRef = useRef<string>('');

  // Initialize or re-shuffle study queue when deck changes
  useEffect(() => {
    if (deckCards.length === 0) {
      setStudyQueue([]);
      setCurrentIndex(0);
      setSessionCompleted(false);
      return;
    }
    // Sort due cards first, then new cards
    const sorted = [...deckCards].sort((a, b) => {
      const aDue = new Date(a.dueDate || 0).getTime();
      const bDue = new Date(b.dueDate || 0).getTime();
      return aDue - bDue;
    });

    setStudyQueue(sorted);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setEvalResult(null);
    setMicTranscript('');
  }, [deckCards]);

  const currentCard: Card | undefined = studyQueue[currentIndex];

  // Determine current card mode if 'random': alternates or based on card index
  const resolvedCardMode = useMemo<'vietnamese_to_writing' | 'hanzi_to_meaning'>(() => {
    if (studyMode === 'vietnamese_to_writing') return 'vietnamese_to_writing';
    if (studyMode === 'hanzi_to_meaning') return 'hanzi_to_meaning';
    // Random / Alternating: Even indices = write Hanzi, Odd indices = read Hanzi
    return currentIndex % 2 === 0 ? 'vietnamese_to_writing' : 'hanzi_to_meaning';
  }, [studyMode, currentIndex]);

  // Play standard pronunciation
  const handlePlayAudio = (text?: string) => {
    const textToSpeak = text || currentCard?.hanzi;
    if (textToSpeak) {
      speechService.speak(textToSpeak);
    }
  };

  // Flip card
  const handleFlipCard = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      // Auto-play pronunciation when flipped
      if (currentCard?.hanzi) {
        handlePlayAudio(currentCard.hanzi);
      }
    }
  };

  // Record SRS Review rating
  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;

    await onRecordReview(currentCard, rating, resolvedCardMode);

    // If rated 1 (Again), push to the end of current session to reinforce memory!
    if (rating === 1) {
      setStudyQueue((prev) => [...prev, currentCard]);
    }

    if (currentIndex + 1 < studyQueue.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setShowWritingHint(false);
      setEvalResult(null);
      setMicTranscript('');
    } else {
      // Session finished!
      setSessionCompleted(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#b91c1c', '#d97706', '#059669', '#2563eb'],
        });
      } catch {}
    }
  };

  // Start voice recognition to check pronunciation
  const handleToggleVoiceRecord = () => {
    if (isListening) {
      voiceRecorder?.stop();
      setIsListening(false);
      const textToEvaluate = micTranscriptRef.current || micTranscript;
      if (textToEvaluate.trim()) {
        evaluateAudioWithAi(textToEvaluate.trim());
      }
      return;
    }

    if (!speechService.isRecognitionSupported()) {
      setEvalResult({
        accuracyScore: 0,
        recognizedText: '',
        toneFeedback: 'Trình duyệt hiện chưa hỗ trợ Web Speech Recognition.',
        tips: 'Bạn có thể sử dụng Google Chrome trên máy tính hoặc Android để trải nghiệm tính năng luyện phát âm!',
        isCorrect: false,
      });
      return;
    }

    micTranscriptRef.current = '';
    setMicTranscript('');
    setEvalResult(null);
    setIsListening(true);

    const recorder = speechService.startListening(
      (transcript, isFinal) => {
        micTranscriptRef.current = transcript;
        setMicTranscript(transcript);
        if (isFinal) {
          setIsListening(false);
          // Evaluate with AI
          evaluateAudioWithAi(transcript);
        }
      },
      (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      }
    );

    setVoiceRecorder(recorder);
  };

  // Call server to evaluate pronunciation
  const evaluateAudioWithAi = async (spokenText: string) => {
    if (!currentCard || !spokenText.trim()) return;
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/evaluate-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHanzi: currentCard.hanzi,
          targetPinyin: currentCard.pinyin,
          recognizedText: spokenText,
        }),
      });
      const data = await res.json();
      if (data.success && data.evaluation) {
        setEvalResult(data.evaluation);
      }
    } catch (e) {
      console.warn('Failed to evaluate audio:', e);
      // Fallback local check
      const isMatch = spokenText.trim() === currentCard.hanzi.trim();
      setEvalResult({
        accuracyScore: isMatch ? 95 : 65,
        recognizedText: spokenText,
        toneFeedback: isMatch ? 'Phát âm chuẩn xác!' : `Âm nhận diện: "${spokenText}". Chú ý thanh điệu ${currentCard.pinyin}.`,
        tips: 'Hãy lắng nghe phát âm chuẩn của người bản ngữ và thử lại.',
        isCorrect: isMatch,
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const restartSession = () => {
    if (deckCards.length > 0) {
      setStudyQueue([...deckCards]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionCompleted(false);
      setEvalResult(null);
      setMicTranscript('');
    }
  };

  // If no cards in selected deck
  if (deckCards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
          <BookA className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Chưa có từ vựng nào trong bộ này</h2>
        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          Hãy thêm từ vựng mới, nhập danh sách từ file Anki/CSV hoặc chụp ảnh tài liệu qua camera để tự động tạo flashcard.
        </p>
        <button
          type="button"
          onClick={onNavigateToDecks}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-medium text-sm shadow-xs transition-colors"
        >
          <span>Quản lý & Thêm Từ Vựng</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Session completed view
  if (sessionCompleted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 shadow-xs border-2 border-emerald-200">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Hoàn thành phiên ôn tập!</h2>
        <p className="text-stone-600 text-sm mb-6 leading-relaxed">
          Bạn vừa hoàn thành ôn tập <strong>{studyQueue.length}</strong> từ vựng. Thuật toán Spaced Repetition đã tự động lập lịch ngày ôn tối ưu cho từng từ.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={restartSession}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Ôn lại lần nữa</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToDecks}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm border border-stone-200 transition-colors"
          >
            <span>Xem danh sách từ</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
      {/* Session Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-stone-200/70">
        {/* Deck Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor={currentDeckSelectId} className="text-xs text-stone-500 font-medium">Bộ từ:</label>
          <select
            id={currentDeckSelectId}
            value={currentDeckId}
            onChange={(e) => setCurrentDeckId(e.target.value)}
            className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value="all">Tất cả bộ từ ({cards.length})</option>
            {decks.some((d) => d.isSystem) && (
              <optgroup label="🌟 BỘ TỪ MẶC ĐỊNH HỆ THỐNG">
                {decks
                  .filter((d) => d.isSystem)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.cardCount})
                    </option>
                  ))}
              </optgroup>
            )}
            {decks.some((d) => !d.isSystem) && (
              <optgroup label="👤 BỘ TỪ CÁ NHÂN CỦA BẠN">
                {decks
                  .filter((d) => !d.isSystem)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.cardCount})
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Study Mode Selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor={studyModeSelectId} className="text-xs text-stone-500 font-medium hidden sm:inline">Chế độ:</label>
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-xs">
            <select
              id={studyModeSelectId}
              value={studyMode}
              onChange={(e) => setStudyMode(e.target.value as StudyMode)}
              className="sr-only"
            >
              <option value="random">Ngẫu nhiên</option>
              <option value="vietnamese_to_writing">Tập viết</option>
              <option value="hanzi_to_meaning">Nhớ nghĩa</option>
            </select>
            <button
              type="button"
              onClick={() => setStudyMode('random')}
              title="Ngẫu nhiên đan xen: Vừa tập viết, vừa nhận diện mặt chữ"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                studyMode === 'random'
                  ? 'bg-white font-medium text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Shuffle className="w-3 h-3 text-red-700" />
              <span>Ngẫu nhiên</span>
            </button>
            <button
              type="button"
              onClick={() => setStudyMode('vietnamese_to_writing')}
              title="Hiển thị tiếng Việt (ẩn Pinyin), yêu cầu viết chữ Hán"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                studyMode === 'vietnamese_to_writing'
                  ? 'bg-white font-medium text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <PenTool className="w-3 h-3 text-amber-700" />
              <span>Tập viết</span>
            </button>
            <button
              type="button"
              onClick={() => setStudyMode('hanzi_to_meaning')}
              title="Hiển thị chữ Hán, nhớ Pinyin và nghĩa tiếng Việt"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                studyMode === 'hanzi_to_meaning'
                  ? 'bg-white font-medium text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookA className="w-3 h-3 text-emerald-700" />
              <span>Nhớ nghĩa</span>
            </button>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="text-xs font-semibold text-stone-500 flex items-center gap-1.5 ml-auto sm:ml-0">
          <span>
            {studyQueue.length > 0 ? currentIndex + 1 : 0} / {studyQueue.length}
          </span>
          <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-700 rounded-full transition-all duration-300"
              style={{ width: `${studyQueue.length > 0 ? ((currentIndex + 1) / studyQueue.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tag / Lesson Multi-Select Filter Bar */}
      {availableTags.length > 0 && (
        <div className="mb-5 p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <Tag className="w-3.5 h-3.5 text-red-700" />
              <span>Lọc học theo Tag / Bài học:</span>
            </div>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={handleClearTags}
                className="text-[11px] text-red-700 hover:underline font-semibold"
              >
                Học tất cả ({baseDeckCards.length} từ)
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* 'All Tags' button */}
            <button
              type="button"
              onClick={handleClearTags}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedTags.length === 0
                  ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Tất cả ({baseDeckCards.length})
            </button>

            {/* Individual Tag toggle pills */}
            {availableTags.map(({ tag, count }) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-red-700 text-white shadow-2xs font-semibold ring-1 ring-red-800'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <span>{isSelected ? '✓ ' : ''}{tag}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full ${
                      isSelected ? 'bg-red-800 text-white' : 'bg-white text-stone-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTags.length > 0 && (
            <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
              <span>
                Đang chọn học: <strong className="text-stone-800">{studyQueue.length} từ</strong> thuộc {selectedTags.length === 1 ? `nhãn "${selectedTags[0]}"` : `${selectedTags.length} nhãn: [${selectedTags.join(', ')}]`}
              </span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Có thể chọn 1 hoặc nhiều nhãn cùng lúc
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Flashcard Card */}
      {currentCard ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden transition-all">
          {/* Card Header Tag */}
          <div className="px-5 py-3 bg-[#fbf9f5] border-b border-stone-200/70 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-700">
                {resolvedCardMode === 'vietnamese_to_writing' ? 'Chế độ: Nhớ chữ Hán & Tập Viết' : 'Chế độ: Đọc & Nhớ Nghĩa'}
              </span>
              <span className="text-xs text-stone-400">
                {currentCard.status === 'new'
                  ? 'Từ mới'
                  : `Ôn tập (lặp ${currentCard.repetitions} lần)`}
              </span>

              {/* Card Tags Badges */}
              {currentCard.tags && currentCard.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {currentCard.tags.map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200/70"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Listen button */}
            <button
              type="button"
              onClick={() => handlePlayAudio(currentCard.hanzi)}
              title="Nghe phát âm chuẩn người bản ngữ"
              className="p-1.5 text-stone-600 hover:text-red-700 rounded-lg hover:bg-stone-200/50 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Flashcard Body */}
          <div className="p-5 sm:p-7">
            {resolvedCardMode === 'vietnamese_to_writing' ? (
              /* MODE 1: VIETNAMESE -> WRITE HANZI */
              <div className="space-y-4">
                {/* Question: Vietnamese Meaning (NO Pinyin) */}
                <div className="text-center">
                  <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
                    Nghĩa Tiếng Việt
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 font-vietnamese tracking-normal">
                    {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Hãy nhớ mặt chữ và viết chữ Hán tương ứng vào ô bên dưới
                  </p>

                  {/* Nút Gợi Ý Mặt Chữ Hán nếu quên */}
                  <div className="mt-2.5 flex items-center justify-center">
                    {!showWritingHint ? (
                      <button
                        type="button"
                        onClick={() => setShowWritingHint(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-full transition-all shadow-2xs hover:scale-105 active:scale-95"
                        title="Bấm để xem gợi ý mặt chữ Hán nếu bạn không nhớ"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                        <span>Gợi ý mặt chữ Hán (nếu quên)</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-2xl shadow-xs animate-fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                          <Lightbulb className="w-4 h-4 text-amber-600 fill-amber-500 animate-pulse" />
                          <span>Gợi ý:</span>
                        </div>
                        <span className="font-hanzi font-bold text-2xl sm:text-3xl text-stone-900 tracking-wider">
                          {currentCard.hanzi}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-red-700 bg-white/80 px-2 py-0.5 rounded-lg border border-red-200/70">
                          {currentCard.pinyin}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowWritingHint(false)}
                          className="text-[11px] font-medium text-stone-600 hover:text-stone-950 ml-1 px-2 py-1 rounded-lg hover:bg-amber-200/60 transition-colors"
                          title="Ẩn gợi ý để tự nhớ lại và viết"
                        >
                          Ẩn
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calligraphy Writing Canvas (米字格) */}
                <div className="py-2">
                  <HanziCanvas
                    key={`canvas-${currentCard.id}`}
                    targetHanzi={currentCard.hanzi}
                    showGhostByDefault={false}
                    hideCharacterPrompt={!showWritingHint}
                    onCharacterCompleted={(isSuccess) => {
                      if (isSuccess && !isFlipped) {
                        setIsFlipped(true);
                      }
                    }}
                  />
                </div>

                {/* Flipped State: Reveal Hanzi, Pinyin & Example */}
                {isFlipped && (
                  <div className="mt-4 pt-4 border-t border-stone-200/70 animate-fade-in space-y-3 bg-amber-50/40 -mx-5 -mb-5 p-5">
                    <div className="text-center">
                      <div className="text-4xl sm:text-5xl font-hanzi text-stone-900 font-bold mb-1">
                        {currentCard.hanzi}
                      </div>
                      <div className="text-base sm:text-lg font-medium text-red-700">
                        {currentCard.pinyin}
                      </div>
                    </div>

                    {/* Example Sentence */}
                    {currentCard.exampleSentence && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200/60 text-xs sm:text-sm space-y-1">
                        <div className="flex items-center justify-between text-stone-500 font-medium">
                          <span>Câu ví dụ:</span>
                          <button
                            type="button"
                            onClick={() => handlePlayAudio(currentCard.exampleSentence)}
                            className="p-1 hover:text-red-700"
                            title="Nghe câu ví dụ"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-hanzi text-stone-900 text-sm font-semibold">
                          {currentCard.exampleSentence}
                        </p>
                        {currentCard.examplePinyin && (
                          <p className="text-stone-500 text-xs">{currentCard.examplePinyin}</p>
                        )}
                        {currentCard.exampleMeaning && (
                          <p className="text-stone-600 text-xs italic">{currentCard.exampleMeaning}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* MODE 2: HANZI -> READ & RECALL MEANING */
              <div className="space-y-5 text-center">
                {/* Chinese Character Prompt */}
                <div className="py-4">
                  <div className="text-5xl sm:text-6xl font-hanzi font-bold text-stone-900 mb-2">
                    {currentCard.hanzi}
                  </div>
                  <p className="text-xs text-stone-500">
                    Đọc to thành tiếng, nhớ Pinyin và nghĩa tiếng Việt
                  </p>
                </div>

                {/* Optional mini canvas for doodling in Mode 2 as well */}
                <div className="flex justify-center">
                  <HanziCanvas
                    key={`canvas-read-${currentCard.id}`}
                    targetHanzi={currentCard.hanzi}
                    showGhostByDefault={false}
                  />
                </div>

                {/* Flipped State: Reveal Pinyin & Meaning */}
                {isFlipped && (
                  <div className="mt-4 pt-4 border-t border-stone-200/70 animate-fade-in space-y-3 bg-amber-50/40 -mx-5 -mb-5 p-5 text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg sm:text-xl font-bold text-red-700">
                          {currentCard.pinyin}
                        </div>
                        <div className="text-base font-semibold text-stone-900 font-vietnamese mt-0.5">
                          {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayAudio(currentCard.hanzi)}
                        className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-700 hover:text-red-700 shadow-2xs"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Example Sentence */}
                    {currentCard.exampleSentence && (
                      <div className="mt-2 p-3 bg-white rounded-xl border border-amber-200/60 text-xs sm:text-sm space-y-1">
                        <div className="flex items-center justify-between text-stone-500 font-medium">
                          <span>Câu ví dụ:</span>
                          <button
                            type="button"
                            onClick={() => handlePlayAudio(currentCard.exampleSentence)}
                            className="p-1 hover:text-red-700"
                            title="Nghe câu ví dụ"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-hanzi text-stone-900 text-sm font-semibold">
                          {currentCard.exampleSentence}
                        </p>
                        {currentCard.examplePinyin && (
                          <p className="text-stone-500 text-xs">{currentCard.examplePinyin}</p>
                        )}
                        {currentCard.exampleMeaning && (
                          <p className="text-stone-600 text-xs italic">{currentCard.exampleMeaning}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pronunciation Recording & AI Comparison Bar */}
            <div className="mt-5 pt-4 border-t border-stone-200/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kiểm tra phát âm giọng đọc:</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(currentCard.hanzi)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-red-700" />
                    <span>Giọng bản ngữ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleVoiceRecord}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      isListening
                        ? 'bg-red-600 text-white animate-pulse shadow-xs'
                        : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Đang nghe... Bấm để chấm điểm</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Thu âm đọc thử</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Listening helpful hint */}
              {isListening && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between animate-fade-in">
                  <span>🎤 Bạn hãy đọc to từ này. Đọc xong dừng 1s (máy tự chấm) hoặc bấm nút đỏ để chấm ngay.</span>
                </div>
              )}

              {/* Real-time transcript feedback */}
              {micTranscript && (
                <div className="text-xs bg-stone-50 p-2 rounded-lg border border-stone-200 flex items-center justify-between">
                  <span className="text-stone-600">
                    Âm nhận diện: <strong>{micTranscript}</strong>
                  </span>
                  {isEvaluating && <span className="text-amber-600 text-[11px]">Đang chấm điểm...</span>}
                </div>
              )}

              {/* AI Pronunciation Evaluation Card */}
              {evalResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                    evalResult.isCorrect
                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50/70 border-amber-300 text-amber-950'
                  }`}
                >
                  {/* Header: Status + Score */}
                  <div className="flex items-center justify-between font-bold border-b pb-2 border-stone-200/60">
                    <span className="flex items-center gap-1.5 text-sm">
                      {evalResult.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      )}
                      <span>{evalResult.isCorrect ? 'Phát âm chuẩn xác!' : 'Cần điều chỉnh thêm'}</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        evalResult.isCorrect
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      Điểm: {evalResult.accuracyScore}/100
                    </span>
                  </div>

                  {/* Phonetic Breakdown Pills */}
                  {evalResult.phoneticBreakdown && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-stone-500 font-medium">Cấu tạo âm:</span>
                      {evalResult.phoneticBreakdown.initial && (
                        <span className="px-2 py-0.5 bg-white rounded-md border border-stone-200 font-semibold text-stone-700">
                          Thanh mẫu: <strong className="text-red-700">{evalResult.phoneticBreakdown.initial}</strong>
                        </span>
                      )}
                      {evalResult.phoneticBreakdown.final && (
                        <span className="px-2 py-0.5 bg-white rounded-md border border-stone-200 font-semibold text-stone-700">
                          Vận mẫu: <strong className="text-blue-700">{evalResult.phoneticBreakdown.final}</strong>
                        </span>
                      )}
                      {evalResult.phoneticBreakdown.toneName && (
                        <span className="px-2 py-0.5 bg-white rounded-md border border-stone-200 font-semibold text-stone-700">
                          Thanh điệu: <strong className="text-amber-800">{evalResult.phoneticBreakdown.toneName}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* 1. CHỈ RÕ CHỖ SAI */}
                  {evalResult.mistakeDetail && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                        evalResult.isCorrect
                          ? 'bg-white/80 border-emerald-200 text-emerald-900'
                          : 'bg-red-50/80 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                        {evalResult.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đánh giá độ chuẩn xác:</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>Chỉ rõ điểm sai:</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] font-medium">{evalResult.mistakeDetail}</p>
                    </div>
                  )}

                  {/* 2. HƯỚNG DẪN SỬA CÁCH ĐỌC */}
                  {evalResult.correctionGuide && (
                    <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/90 text-blue-950 text-xs leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider text-blue-800">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>Hướng dẫn sửa cách đọc từng bước:</span>
                      </div>
                      <p className="text-[11px] whitespace-pre-line">{evalResult.correctionGuide}</p>
                    </div>
                  )}

                  {/* 3. CHI TIẾT THANH ĐIỆU & MẸO NHANH */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    {evalResult.toneFeedback && (
                      <div className="p-2 rounded-lg bg-white/70 border border-stone-200/70">
                        <span className="font-bold text-stone-700 block mb-0.5">🎼 Quy tắc thanh điệu:</span>
                        <span className="text-stone-600">{evalResult.toneFeedback}</span>
                      </div>
                    )}
                    {evalResult.tips && (
                      <div className="p-2 rounded-lg bg-white/70 border border-stone-200/70">
                        <span className="font-bold text-stone-700 block mb-0.5">💡 Mẹo phát âm dễ nhớ:</span>
                        <span className="text-stone-600">{evalResult.tips}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick retry buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => handlePlayAudio(currentCard.hanzi)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-semibold transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-red-700" />
                      <span>Nghe mẫu chuẩn lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleVoiceRecord}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-semibold transition-colors shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thu âm đọc lại</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer: Flip Card OR Rate Buttons */}
          <div className="p-4 bg-stone-50 border-t border-stone-200/80">
            {!isFlipped ? (
              <button
                type="button"
                onClick={handleFlipCard}
                className="w-full py-3 px-4 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold text-sm sm:text-base shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>Lật Thẻ & Xem Đáp Án</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-center text-xs text-stone-500 font-medium">
                  Đánh giá mức độ ghi nhớ (Spaced Repetition SM-2):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Rating 1: Again */}
                  <button
                    type="button"
                    onClick={() => handleRate(1)}
                    className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 transition-colors"
                  >
                    <span className="font-bold text-sm">Quên</span>
                    <span className="text-[10px] text-red-600 mt-0.5">1 ngày (Ôn lại)</span>
                  </button>

                  {/* Rating 2: Hard */}
                  <button
                    type="button"
                    onClick={() => handleRate(2)}
                    className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 transition-colors"
                  >
                    <span className="font-bold text-sm">Khó</span>
                    <span className="text-[10px] text-orange-600 mt-0.5">
                      {formatInterval(Math.max(1, Math.round((currentCard.interval || 1) * 1.2)))}
                    </span>
                  </button>

                  {/* Rating 3: Good */}
                  <button
                    type="button"
                    onClick={() => handleRate(3)}
                    className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-colors"
                  >
                    <span className="font-bold text-sm">Tốt</span>
                    <span className="text-[10px] text-emerald-600 mt-0.5">
                      {formatInterval(
                        currentCard.repetitions === 0
                          ? 1
                          : Math.round(
                              (currentCard.interval || 1) * (currentCard.easeFactor || 2.5)
                            )
                      )}
                    </span>
                  </button>

                  {/* Rating 4: Easy */}
                  <button
                    type="button"
                    onClick={() => handleRate(4)}
                    className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 transition-colors"
                  >
                    <span className="font-bold text-sm">Dễ</span>
                    <span className="text-[10px] text-blue-600 mt-0.5">
                      {formatInterval(
                        Math.round(
                          (currentCard.interval || 1) * (currentCard.easeFactor || 2.5) * 1.3
                        )
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs">
          <Tag className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-bold text-stone-800 text-base mb-1">
            Không tìm thấy từ vựng phù hợp
          </h3>
          <p className="text-xs text-stone-500 mb-4 max-w-sm mx-auto">
            Không có từ vựng nào thuộc các nhãn bài học đang chọn ({selectedTags.join(', ')}).
          </p>
          <button
            type="button"
            onClick={handleClearTags}
            className="px-4 py-2 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors shadow-2xs"
          >
            Học tất cả các từ ({baseDeckCards.length} từ)
          </button>
        </div>
      )}
    </div>
  );
};
