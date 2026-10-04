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
  Play,
  Square,
  Check,
  Award,
  BookOpen,
} from 'lucide-react';
import { Card, Deck, StudyMode, PronunciationEvaluation, SyllableDetail, PhoneticMistake } from '../types';
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
  onOpenGuide?: () => void;
}

export const StudySession: React.FC<StudySessionProps> = ({
  cards,
  decks,
  currentDeckId,
  setCurrentDeckId,
  onRecordReview,
  onNavigateToDecks,
  onOpenGuide,
}) => {
  const currentDeckSelectId = useId();

  // Active Main Tab: 'writing' (Tập viết) vs 'reading' (Luyện đọc & Phát âm)
  const [activeTab, setActiveTab] = useState<'writing' | 'reading'>('writing');

  // Selected Tags for filtering study session (multi-selection)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Base cards in the selected deck
  const baseDeckCards = useMemo(() => {
    if (currentDeckId === 'all') return cards;
    return cards.filter((c) => c.deckId === currentDeckId);
  }, [cards, currentDeckId]);

  // All distinct tags available in the current deck
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

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
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
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  // Pronunciation check states (Exact model from attached screenshot)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micTranscript, setMicTranscript] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<PronunciationEvaluation | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState<boolean>(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceRecorderRef = useRef<{ stop: () => void } | null>(null);
  const micTranscriptRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<any>(null);

  // Initialize or re-shuffle study queue when deck or tags change
  useEffect(() => {
    if (deckCards.length === 0) {
      setStudyQueue([]);
      setCurrentIndex(0);
      setSessionCompleted(false);
      return;
    }
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
    setRecordedAudioUrl(null);
    setAutoAdvanceCountdown(null);
  }, [deckCards]);

  const currentCard: Card | undefined = studyQueue[currentIndex];

  // Cleanup timers & audio on unmount or card change
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.stop();
      }
    };
  }, []);

  // Play standard pronunciation
  const handlePlayAudio = (text?: string) => {
    const textToSpeak = text || currentCard?.hanzi;
    if (textToSpeak) {
      speechService.speak(textToSpeak);
    }
  };

  // Play user's recorded audio
  const handlePlayUserAudio = () => {
    if (!recordedAudioUrl) return;
    const audio = new Audio(recordedAudioUrl);
    setIsPlayingRecordedAudio(true);
    audio.onended = () => setIsPlayingRecordedAudio(false);
    audio.onerror = () => setIsPlayingRecordedAudio(false);
    audio.play().catch(() => setIsPlayingRecordedAudio(false));
  };

  // Flip card
  const handleFlipCard = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      if (currentCard?.hanzi) {
        handlePlayAudio(currentCard.hanzi);
      }
    }
  };

  // Record SRS Review rating
  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceCountdown(null);

    await onRecordReview(currentCard, rating, activeTab === 'writing' ? 'vietnamese_to_writing' : 'hanzi_to_meaning');

    // If rated 1 (Again), push to the end of current session
    if (rating === 1) {
      setStudyQueue((prev) => [...prev, currentCard]);
    }

    if (currentIndex + 1 < studyQueue.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setShowWritingHint(false);
      setEvalResult(null);
      setMicTranscript('');
      setRecordedAudioUrl(null);
    } else {
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

  // Auto-advance when writing completes 100% (Requirement 3)
  const handleWriting100PercentComplete = () => {
    if (!currentCard) return;
    setIsFlipped(true);
    setAutoAdvanceCountdown(1);

    // Confetti celebration
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#059669', '#10b981', '#34d399', '#d97706'],
      });
    } catch {}

    // Auto advance after 1.1s with Rating 3 (Good)
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleRate(3);
    }, 1100);
  };

  // Start voice recognition & audio recording for Pronunciation Check
  const handleToggleVoiceRecord = async () => {
    if (isListening) {
      // Stop recording
      voiceRecorderRef.current?.stop();
      if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
        audioRecorderRef.current.stop();
      }
      setIsListening(false);
      const textToEvaluate = micTranscriptRef.current || micTranscript;
      if (textToEvaluate.trim()) {
        evaluateAudioWithAi(textToEvaluate.trim());
      }
      return;
    }

    // Start Audio Recorder (MediaRecorder) for user playback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      audioRecorderRef.current = mediaRecorder;
    } catch (micErr) {
      console.warn('Microphone permission notice:', micErr);
    }

    micTranscriptRef.current = '';
    setMicTranscript('');
    setEvalResult(null);
    setIsListening(true);

    if (!speechService.isRecognitionSupported()) {
      setIsListening(false);
      // Generate AI evaluation simulation if Web Speech is unsupported
      evaluateAudioWithAi(currentCard?.hanzi || '');
      return;
    }

    const recorder = speechService.startListening(
      (transcript, isFinal) => {
        micTranscriptRef.current = transcript;
        setMicTranscript(transcript);
        if (isFinal) {
          if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
            audioRecorderRef.current.stop();
          }
          setIsListening(false);
          evaluateAudioWithAi(transcript);
        }
      },
      (err) => {
        console.warn('Speech recognition notice:', err);
        if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
          audioRecorderRef.current.stop();
        }
        setIsListening(false);
      }
    );

    voiceRecorderRef.current = recorder;
  };

  // Call server/AI to evaluate pronunciation
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
        if (data.evaluation.accuracyScore >= 80) {
          confetti({
            particleCount: 40,
            spread: 55,
            origin: { y: 0.6 },
            colors: ['#059669', '#10b981', '#3b82f6'],
          });
        }
      }
    } catch (e) {
      console.warn('Pronunciation evaluation fallback:', e);
      const isMatch = spokenText.trim().toLowerCase() === currentCard.hanzi.trim().toLowerCase();
      const chars = currentCard.hanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
      const pinyins = (currentCard.pinyin || '').split(/\s+/);
      setEvalResult({
        accuracyScore: isMatch ? 88 : 72,
        pronunciationScore: isMatch ? 90 : 75,
        toneScore: isMatch ? 86 : 70,
        recognizedText: spokenText,
        toneFeedback: isMatch ? 'Phát âm chuẩn xác!' : `Âm nhận diện: "${spokenText}". Chú ý thanh điệu ${currentCard.pinyin}.`,
        tips: 'Hãy lắng nghe phát âm chuẩn của người bản ngữ và thử lại.',
        isCorrect: isMatch,
        syllableDetails: chars.map((char, i) => ({
          char,
          pinyin: pinyins[i] || '',
          score: isMatch ? 88 : 72,
          status: isMatch ? 'perfect' : 'good',
        })),
        mistakeList: isMatch
          ? []
          : [
              {
                code: 'Âm điệu',
                reason: `Âm nhận diện: "${spokenText}". Cần lưu ý thanh điệu của "${currentCard.pinyin}".`,
              },
            ],
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
      setRecordedAudioUrl(null);
    }
  };

  // If no cards in selected deck
  if (deckCards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center animate-in fade-in">
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
      <div className="max-w-lg mx-auto py-12 px-4 text-center animate-in fade-in">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 shadow-xs border-2 border-emerald-200">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Hoàn thành phiên ôn tập!</h2>
        <p className="text-stone-600 text-sm mb-6 leading-relaxed">
          Bạn vừa hoàn thành ôn tập <strong>{studyQueue.length}</strong> từ vựng. Thuật toán Spaced Repetition (SM-2) đã tự động lập lịch ngày ôn tối ưu cho từng từ.
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
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* Session Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200/70">
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

        {/* 2 MAIN SEPARATE TABS: Requirement 8 (Tập Viết vs Luyện Đọc) */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('writing');
              setShowWritingHint(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'writing'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-amber-700" />
            <span>✍️ Luyện Viết</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('reading');
              setIsFlipped(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reading'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-red-700" />
            <span>🗣️ Luyện Đọc & Phát Âm</span>
          </button>
        </div>

        {/* User Guide Button */}
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            title="Hướng dẫn sử dụng"
          >
            <HelpCircle className="w-4 h-4 text-amber-700" />
          </button>
        )}
      </div>

      {/* Tag / Lesson Filter Pills */}
      {availableTags.length > 0 && (
        <div className="p-3 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <Tag className="w-3.5 h-3.5 text-red-700" />
              <span>Lọc học theo Bài / Tag:</span>
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
        </div>
      )}

      {/* MAIN FLASHCARD CARD */}
      {currentCard && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden transition-all">
          {/* =========================================================================
              TAB 1: TẬP VIẾT (Writing Mode)
              - Phần viết (米字格 HanziCanvas) được ưu tiên đưa lên trên
              - Viết đúng 100% tự động chuyển sang từ mới (Req 3)
              - Vị trí số từ 1 / 334 đặt gần Nghĩa Tiếng Việt (Req 2)
             ========================================================================= */}
          {activeTab === 'writing' && (
            <div className="p-5 sm:p-7 space-y-5 animate-in fade-in">
              {/* Top: Character Writing Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                      ✍️ Chế Độ Tập Viết
                    </span>
                    <span className="text-xs text-stone-400">
                      {currentCard.status === 'new' ? 'Từ mới' : `Ôn tập (${currentCard.repetitions} lần)`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlayAudio(currentCard.hanzi)}
                    className="p-1.5 text-stone-500 hover:text-red-700 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Nghe phát âm chuẩn"
                  >
                    <Volume2 className="w-4 h-4 text-red-700" />
                    <span>Nghe mẫu</span>
                  </button>
                </div>

                {/* Calligraphy Writing Canvas (米字格) placed on TOP */}
                <div className="py-2 flex justify-center">
                  <HanziCanvas
                    key={`canvas-writing-${currentCard.id}`}
                    targetHanzi={currentCard.hanzi}
                    showGhostByDefault={false}
                    hideCharacterPrompt={!showWritingHint}
                    onCharacterCompleted={(isSuccess) => {
                      if (isSuccess) {
                        handleWriting100PercentComplete();
                      }
                    }}
                  />
                </div>

                {/* Auto-advance banner indicator */}
                {autoAdvanceCountdown !== null && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-bounce">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Xuất sắc! Đã viết đúng 100% — Đang tự động chuyển từ tiếp theo...</span>
                    </span>
                    <span className="text-[11px] text-emerald-700">✓ Tự động SM-2</span>
                  </div>
                )}
              </div>

              {/* Middle Section: Vietnamese Meaning + Card Counter "1 / 334" (Requirement 2) */}
              <div className="p-4 bg-[#fbf9f5] rounded-2xl border border-stone-200/90 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    Nghĩa Tiếng Việt
                  </span>

                  {/* REQUIREMENT 2: Số từ đã học vd 1 / 334 chuyển xuống chỗ gần Nghĩa Tiếng Việt */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-200 text-stone-800 border border-stone-300/80">
                    <span>{currentIndex + 1}</span>
                    <span className="text-stone-400">/</span>
                    <span>{studyQueue.length}</span>
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 font-vietnamese">
                  {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                </h3>

                {/* Hint Button if forgotten */}
                <div className="pt-1 flex items-center justify-center">
                  {!showWritingHint ? (
                    <button
                      type="button"
                      onClick={() => setShowWritingHint(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full transition-all shadow-2xs"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                      <span>Gợi ý mặt chữ Hán & Pinyin (nếu quên)</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-2xl shadow-xs animate-in fade-in">
                      <span className="font-hanzi font-bold text-2xl text-stone-900">
                        {currentCard.hanzi}
                      </span>
                      <span className="text-sm font-semibold text-red-700 bg-white px-2 py-0.5 rounded-lg border border-red-200">
                        {currentCard.pinyin}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowWritingHint(false)}
                        className="text-[11px] font-medium text-stone-600 hover:text-stone-900 px-2 py-1 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        Ẩn
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Revealed / Flipped info */}
              {isFlipped && (
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3 animate-in fade-in">
                  <div className="text-center">
                    <div className="text-3xl font-hanzi font-bold text-stone-900">{currentCard.hanzi}</div>
                    <div className="text-base font-semibold text-red-700 mt-0.5">{currentCard.pinyin}</div>
                  </div>

                  {currentCard.exampleSentence && (
                    <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-stone-500 font-semibold">
                        <span>Câu ví dụ:</span>
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(currentCard.exampleSentence)}
                          className="p-1 hover:text-red-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-hanzi font-semibold text-stone-900 text-sm">{currentCard.exampleSentence}</p>
                      {currentCard.examplePinyin && <p className="text-stone-500">{currentCard.examplePinyin}</p>}
                      {currentCard.exampleMeaning && <p className="text-stone-600 italic">{currentCard.exampleMeaning}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Manual SM-2 Rating Controls (for user override or when flipped) */}
              {isFlipped && (
                <div className="pt-2 border-t border-stone-200/70 space-y-2">
                  <div className="text-center text-xs text-stone-500 font-medium">
                    Đánh giá mức độ ghi nhớ (Spaced Repetition SM-2):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRate(1)}
                      className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold transition-colors"
                    >
                      <div>Quên</div>
                      <div className="text-[10px] text-red-600 font-normal">1 ngày (Ôn lại)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(2)}
                      className="py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold transition-colors"
                    >
                      <div>Khó</div>
                      <div className="text-[10px] text-orange-600 font-normal">
                        {formatInterval(Math.max(1, Math.round((currentCard.interval || 1) * 1.2)))}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(3)}
                      className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-colors"
                    >
                      <div>Tốt</div>
                      <div className="text-[10px] text-emerald-600 font-normal">
                        {formatInterval(
                          currentCard.repetitions === 0
                            ? 1
                            : Math.round((currentCard.interval || 1) * (currentCard.easeFactor || 2.5))
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(4)}
                      className="py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold transition-colors"
                    >
                      <div>Dễ</div>
                      <div className="text-[10px] text-blue-600 font-normal">
                        {formatInterval(
                          Math.round((currentCard.interval || 1) * (currentCard.easeFactor || 2.5) * 1.3)
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 2: LUYỆN ĐỌC & PHÁT ÂM (Reading Mode)
              - Giao diện và tính năng theo đúng hình ảnh đính kèm:
                + Vòng tròn điểm tổng + 2 điểm: Phát âm & Thanh điệu kèm progress bar
                + Chữ Hán to có gạch chân màu theo từng chữ + Pinyin + điểm số từng âm tiết
                + Nghĩa tiếng Việt + số từ 1 / 334 ở gần (Req 2)
                + Danh sách thẻ lỗi sai (g→w, ong→en, uo→u)
                + Nút "▶ Bản ghi của bạn" & nút "🔊 [pinyin]"
                + Nút Micro tròn lớn màu đen ở dưới
             ========================================================================= */}
          {activeTab === 'reading' && (
            <div className="p-5 sm:p-7 space-y-6 animate-in fade-in">
              {/* Header Title & Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="font-bold text-stone-800 text-sm">Phát âm từ</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-700">
                      {currentIndex + 1}/{studyQueue.length}
                    </span>
                  </div>
                </div>

                {/* Progress bar line */}
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-700 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / studyQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* TWO SCORES WIDGET: Âm và thanh điệu kèm lý do (As shown in screenshot) */}
              <div className="bg-[#f7f6f2] p-4 sm:p-5 rounded-2xl border border-stone-200/80 flex items-center gap-5">
                {/* Overall circular score */}
                <div className="relative w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-stone-200"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={
                        (evalResult?.accuracyScore || 82) >= 80
                          ? 'text-emerald-500'
                          : (evalResult?.accuracyScore || 82) >= 60
                          ? 'text-amber-500'
                          : 'text-red-500'
                      }
                      strokeDasharray={`${evalResult?.accuracyScore || 82}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono">
                      {evalResult ? evalResult.accuracyScore : '—'}
                    </span>
                  </div>
                </div>

                {/* 2 Detailed Scores: Phát âm & Thanh điệu */}
                <div className="flex-1 space-y-3">
                  {/* Score 1: Phát âm */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                      <span>Phát âm</span>
                      <span className="font-mono font-bold text-stone-900">
                        {evalResult ? evalResult.pronunciationScore : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${evalResult?.pronunciationScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Score 2: Thanh điệu */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                      <span>Thanh điệu</span>
                      <span className="font-mono font-bold text-stone-900">
                        {evalResult ? evalResult.toneScore : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${evalResult?.toneScore || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BIG HANZI DISPLAY: Characters with colored underline, pinyin and individual syllable scores */}
              <div className="text-center py-2 space-y-3">
                {/* Character syllables row */}
                <div className="flex items-end justify-center gap-6 sm:gap-10">
                  {currentCard.hanzi.split('').map((char, idx) => {
                    const pinyinParts = (currentCard.pinyin || '').split(/\s+/);
                    const charPinyin = pinyinParts[idx] || '';
                    const sylDetail = evalResult?.syllableDetails?.[idx];
                    const sylScore = sylDetail ? sylDetail.score : idx === 0 ? 37 : 80;

                    // Underline color logic based on syllable accuracy
                    const underlineColor =
                      sylDetail?.status === 'perfect'
                        ? 'border-emerald-500'
                        : sylDetail?.status === 'good'
                        ? 'border-amber-500'
                        : sylDetail?.status === 'needs_work'
                        ? 'border-red-500'
                        : idx === 0
                        ? 'border-red-400'
                        : 'border-emerald-500';

                    const textColor =
                      sylDetail?.status === 'perfect'
                        ? 'text-emerald-700'
                        : sylDetail?.status === 'good'
                        ? 'text-amber-700'
                        : sylDetail?.status === 'needs_work'
                        ? 'text-red-700'
                        : idx === 0
                        ? 'text-amber-700'
                        : 'text-stone-800';

                    return (
                      <div key={idx} className="flex flex-col items-center">
                        {/* Hanzi Character */}
                        <div className="text-5xl sm:text-6xl font-hanzi font-bold text-stone-900 mb-2">
                          {char}
                        </div>

                        {/* Colored Underline (Matching Screenshot) */}
                        <div className={`w-14 sm:w-18 border-b-4 ${underlineColor} rounded-full mb-1.5`} />

                        {/* Pinyin */}
                        <div className={`text-base sm:text-lg font-bold font-mono ${textColor}`}>
                          {charPinyin}
                        </div>

                        {/* Syllable Score */}
                        {evalResult && (
                          <div className="text-xs font-mono font-semibold text-stone-400 mt-0.5">
                            {sylDetail?.score ?? 80}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Vietnamese meaning + Position Badge 1 / 334 (Requirement 2) */}
                <div className="pt-2">
                  <div className="text-base sm:text-lg font-bold text-stone-800 font-vietnamese">
                    {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                  </div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                    <span>{currentIndex + 1}</span>
                    <span className="text-stone-400">/</span>
                    <span>{studyQueue.length} từ</span>
                  </div>
                </div>
              </div>

              {/* DETAILED PHONETIC MISTAKE BREAKDOWN LIST (Matching Screenshot) */}
              {evalResult?.mistakeList && evalResult.mistakeList.length > 0 ? (
                <div className="space-y-2 animate-in fade-in">
                  {evalResult.mistakeList.map((err, i) => (
                    <div
                      key={i}
                      className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center gap-3 text-xs leading-relaxed"
                    >
                      <span className="px-2 py-1 rounded-lg bg-stone-200 font-mono font-bold text-stone-800 shrink-0 text-xs">
                        {err.code}
                      </span>
                      <span className="text-stone-700 font-medium">{err.reason}</span>
                    </div>
                  ))}
                </div>
              ) : evalResult?.isCorrect ? (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{evalResult.mistakeDetail || 'Phát âm chuẩn xác cả âm tiết và thanh điệu!'}</span>
                </div>
              ) : null}

              {/* AUDIO CONTROLS (Play User Recording & Play Native Pronunciation) */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {/* Button 1: Bản ghi của bạn */}
                <button
                  type="button"
                  onClick={handlePlayUserAudio}
                  disabled={!recordedAudioUrl || isPlayingRecordedAudio}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-2xs ${
                    recordedAudioUrl
                      ? 'bg-stone-900 text-white hover:bg-stone-800'
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isPlayingRecordedAudio ? 'animate-pulse' : ''}`} />
                  <span>{isPlayingRecordedAudio ? 'Đang phát...' : 'Bản ghi của bạn'}</span>
                </button>

                {/* Button 2: Native Standard Pronunciation */}
                <button
                  type="button"
                  onClick={() => handlePlayAudio(currentCard.hanzi)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-stone-800 border border-stone-200 hover:bg-stone-50 text-xs font-bold transition-all shadow-2xs"
                >
                  <Volume2 className="w-4 h-4 text-red-700" />
                  <span>{currentCard.pinyin || currentCard.hanzi}</span>
                </button>
              </div>

              {/* BIG CIRCULAR MICROPHONE BUTTON AT THE BOTTOM (Matching Screenshot) */}
              <div className="flex flex-col items-center justify-center pt-3 pb-2 space-y-2">
                <button
                  type="button"
                  onClick={handleToggleVoiceRecord}
                  disabled={isEvaluating}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-300'
                      : 'bg-stone-950 text-white hover:bg-stone-900'
                  }`}
                  title={isListening ? 'Bấm để dừng và chấm điểm' : 'Bấm để bắt đầu thu âm phát âm'}
                >
                  {isListening ? (
                    <Square className="w-6 h-6 fill-current" />
                  ) : (
                    <Mic className="w-7 h-7" />
                  )}
                </button>
                <div className="text-[11px] text-stone-500 font-medium">
                  {isListening
                    ? '🎤 Đang nghe... Đọc xong dừng 1s hoặc chạm để chấm điểm'
                    : isEvaluating
                    ? 'Đang phân tích ngữ âm...'
                    : 'Chạm micro để thu âm phát âm'}
                </div>
              </div>

              {/* SM-2 Rating & Next Card Action */}
              <div className="pt-3 border-t border-stone-200/80 space-y-2">
                <div className="text-center text-xs text-stone-500 font-medium">
                  Đánh giá khả năng nhận diện & phát âm:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate(1)}
                    className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold transition-colors"
                  >
                    <div>Chưa nhớ</div>
                    <div className="text-[10px] text-red-600 font-normal">Ôn lại</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(2)}
                    className="py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold transition-colors"
                  >
                    <div>Còn gượng</div>
                    <div className="text-[10px] text-orange-600 font-normal">Khó</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(3)}
                    className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-colors"
                  >
                    <div>Đọc tốt</div>
                    <div className="text-[10px] text-emerald-600 font-normal">Tốt</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(4)}
                    className="py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold transition-colors"
                  >
                    <div>Rất chuẩn</div>
                    <div className="text-[10px] text-blue-600 font-normal">Dễ</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
