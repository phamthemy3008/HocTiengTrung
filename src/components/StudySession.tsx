import React, { useState, useEffect, useMemo, useId, useRef, useCallback } from 'react';
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
  Layers,
  Flame,
  Eye,
  EyeOff,
  Headphones,
  BookText,
  AlertTriangle,
} from 'lucide-react';
import { Card, Deck, StudyMode, PronunciationEvaluation, SyllableDetail, PhoneticMistake } from '../types';
import { HanziCanvas } from './HanziCanvas';
import { speechService } from '../services/speech';
import { formatInterval, sortCardsForSM2Queue } from '../services/srs';

interface StudySessionProps {
  cards: Card[];
  decks: Deck[];
  currentDeckId: string;
  setCurrentDeckId: (id: string) => void;
  onRecordReview: (card: Card, rating: 1 | 2 | 3 | 4, mode: string) => Promise<void>;
  onNavigateToDecks: () => void;
  onOpenGuide?: () => void;
  onToggleWeakStatus?: (cardId: string, isWeak: boolean) => Promise<void>;
  openWeakCardsModal?: () => void;
}

export const StudySession: React.FC<StudySessionProps> = ({
  cards,
  decks,
  currentDeckId,
  setCurrentDeckId,
  onRecordReview,
  onNavigateToDecks,
  onOpenGuide,
  onToggleWeakStatus,
  openWeakCardsModal,
}) => {
  const currentDeckSelectId = useId();
  const studyModeSelectId = useId();

  // Study Mode:
  // 'vietnamese_to_writing': Nhìn Nghĩa TV → Viết Hán tự (Nghĩa Việt hiện trên ô viết)
  // 'audio_to_writing': Nghe Âm Đọc → Viết Hán tự (Ẩn nghĩa TV, nghe âm để viết chữ Hán)
  // 'hanzi_to_meaning': Nhớ Nghĩa & Đọc (Hiển thị chữ Hán, ẩn nghĩa & pinyin để luyện đọc & nhớ nghĩa)
  // 'random': Toàn diện / Ngẫu nhiên luân phiên
  const [studyMode, setStudyMode] = useState<StudyMode>('vietnamese_to_writing');

  // Active Sheet inside the single unified study card:
  // 'writing': Sheet 1 - Tập viết chữ Hán (Hanzi Canvas)
  // 'reading': Sheet 2 - Luyện đọc & Phát âm AI (Speech Recognition & Evaluation)
  const [activeSheet, setActiveSheet] = useState<'writing' | 'reading'>('writing');

  // Selected Tags for filtering study session (multi-selection)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Weak cards list
  const weakCards = useMemo(() => {
    return cards.filter(
      (c) => c.isWeak === true || (c.mistakeCount && c.mistakeCount > 0) || c.status === 'learning'
    );
  }, [cards]);

  // Base cards in the selected deck
  const baseDeckCards = useMemo(() => {
    if (currentDeckId === 'weak_cards') return weakCards;
    if (currentDeckId === 'all') return cards;
    return cards.filter((c) => c.deckId === currentDeckId);
  }, [cards, currentDeckId, weakCards]);

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
  const [showWritingMeaning, setShowWritingMeaning] = useState<boolean>(true);
  const [showReadingPinyin, setShowReadingPinyin] = useState<boolean>(false);
  const [showReadingMeaning, setShowReadingMeaning] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [shuffleNotification, setShuffleNotification] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);

  // Pronunciation check states (Matching attached screenshot format)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micTranscript, setMicTranscript] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<PronunciationEvaluation | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState<boolean>(false);
  const [isPlayingStandardAudio, setIsPlayingStandardAudio] = useState<boolean>(false);
  const activeUserAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceRecorderRef = useRef<{ stop: () => void } | null>(null);
  const micTranscriptRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<any>(null);

  // Calculate effective mode for current card in study session
  const currentEffectiveMode = useMemo<Exclude<StudyMode, 'random'>>(() => {
    if (studyMode !== 'random') return studyMode;
    const modes: Exclude<StudyMode, 'random'>[] = [
      'vietnamese_to_writing', // Card 0: Nhìn Nghĩa TV → Viết
      'hanzi_to_meaning',      // Card 1: Nhớ Nghĩa & Luyện Đọc
      'audio_to_writing',      // Card 2: Nghe Âm → Viết (Ẩn nghĩa)
    ];
    return modes[currentIndex % modes.length];
  }, [studyMode, currentIndex]);

  // Set up card view state for a given card index
  const setupCardForIndex = useCallback((nextIdx: number, queue: Card[], currentStudyMode: StudyMode) => {
    const card = queue[nextIdx];
    if (!card) return;

    let effMode: Exclude<StudyMode, 'random'> = 'vietnamese_to_writing';
    if (currentStudyMode === 'random') {
      const modes: Exclude<StudyMode, 'random'>[] = [
        'vietnamese_to_writing',
        'hanzi_to_meaning',
        'audio_to_writing',
      ];
      effMode = modes[nextIdx % modes.length];
    } else {
      effMode = currentStudyMode;
    }

    if (effMode === 'hanzi_to_meaning') {
      setActiveSheet('reading');
      setShowReadingMeaning(false);
      setShowReadingPinyin(false);
      setShowWritingHint(false);
    } else if (effMode === 'audio_to_writing') {
      setActiveSheet('writing');
      setShowWritingMeaning(false);
      setShowWritingHint(false);
      setShowReadingMeaning(false);
      setShowReadingPinyin(false);
      // Auto play pronunciation for listening mode
      setTimeout(() => {
        speechService.speak(card.hanzi);
      }, 150);
    } else {
      // vietnamese_to_writing
      setActiveSheet('writing');
      // If card has contextClue, hide direct meaning by default so learner infers meaning from clue!
      setShowWritingMeaning(!card.contextClue);
      setShowWritingHint(false);
      setShowReadingMeaning(false);
      setShowReadingPinyin(false);
    }

    setIsFlipped(false);
    setEvalResult(null);
    setMicTranscript('');
    setRecordedAudioUrl(null);
  }, []);

  // Track the deck and tags identity so we only re-init the queue when user changes deck/tags
  const currentDeckTagKey = `${currentDeckId}__${selectedTags.slice().sort().join(',')}`;
  const loadedDeckTagKeyRef = useRef<string>('');

  // Initialize study queue ONLY when deck or tags change
  useEffect(() => {
    if (loadedDeckTagKeyRef.current !== currentDeckTagKey || studyQueue.length === 0) {
      loadedDeckTagKeyRef.current = currentDeckTagKey;
      if (deckCards.length === 0) {
        setStudyQueue([]);
        setCurrentIndex(0);
        setSessionCompleted(false);
        return;
      }
      const sorted = sortCardsForSM2Queue(deckCards);

      setStudyQueue(sorted);
      setCurrentIndex(0);
      setSessionCompleted(false);
      setAutoAdvanceCountdown(null);
      setupCardForIndex(0, sorted, studyMode);
    }
  }, [currentDeckTagKey, deckCards, studyMode, setupCardForIndex]);

  const currentCard: Card | undefined = studyQueue[currentIndex];

  // Helper to advance to next card smoothly
  const advanceToNextCard = useCallback(() => {
    if (currentIndex < studyQueue.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupCardForIndex(nextIdx, studyQueue, studyMode);
    } else {
      setSessionCompleted(true);
    }
  }, [currentIndex, studyQueue, studyMode, setupCardForIndex]);

  // Stop all active voice recording processes and release hardware tracks
  const stopVoiceRecording = useCallback(() => {
    setIsListening(false);
    if (voiceRecorderRef.current) {
      try {
        voiceRecorderRef.current.stop();
      } catch {}
      voiceRecorderRef.current = null;
    }
    if (audioRecorderRef.current) {
      if (audioRecorderRef.current.state === 'recording') {
        try {
          audioRecorderRef.current.stop();
        } catch {}
      }
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
  }, []);

  // Cleanup timers & audio on unmount or card change
  useEffect(() => {
    if (currentCard?.hanzi) {
      // Pre-warm HTTP cache for instant playback on mobile and PC
      fetch(`/api/tts?text=${encodeURIComponent(currentCard.hanzi)}`).catch(() => {});
    }
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      stopVoiceRecording();
    };
  }, [currentCard?.hanzi, stopVoiceRecording]);

  const isSpeakingRef = useRef(false);

  // Play standard pronunciation
  const handlePlayAudio = async (text?: string) => {
    if (isSpeakingRef.current) return;
    const textToSpeak = text || currentCard?.hanzi;
    if (!textToSpeak) return;

    isSpeakingRef.current = true;
    setIsPlayingStandardAudio(true);
    try {
      await speechService.speak(textToSpeak);
    } finally {
      setTimeout(() => {
        isSpeakingRef.current = false;
        setIsPlayingStandardAudio(false);
      }, 300);
    }
  };

  // Play user's recorded audio (iOS Safari & Chrome compatible)
  const handlePlayUserAudio = () => {
    if (!recordedAudioUrl) return;
    try {
      if (activeUserAudioRef.current) {
        activeUserAudioRef.current.pause();
        activeUserAudioRef.current.src = '';
      }
      const audio = new Audio();
      activeUserAudioRef.current = audio;
      audio.setAttribute('playsinline', 'true');
      audio.src = recordedAudioUrl;
      setIsPlayingRecordedAudio(true);

      audio.onended = () => setIsPlayingRecordedAudio(false);
      audio.onerror = (e) => {
        console.warn('Recorded audio playback error on iOS:', e);
        setIsPlayingRecordedAudio(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play promise error:', err);
          setIsPlayingRecordedAudio(false);
        });
      }
    } catch (e) {
      console.warn('Audio play exception:', e);
      setIsPlayingRecordedAudio(false);
    }
  };

  // Flip card / reveal answer
  const handleFlipCard = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      setShowWritingMeaning(true);
      setShowReadingMeaning(true);
      setShowReadingPinyin(true);
      setShowWritingHint(true);
      handlePlayAudio(currentCard?.hanzi);
    }
  };

  // Automatic 100% writing completion handler (Requirement 3)
  const handleWriting100PercentComplete = async () => {
    if (!currentCard || autoAdvanceCountdown !== null) return;

    // Confetti celebration
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#b91c1c', '#f59e0b', '#10b981', '#3b82f6'],
    });

    // Auto record SM-2 rating 4 (Dễ / Perfect)
    await onRecordReview(currentCard, 4, 'writing');

    // Auto advance countdown (1.0s)
    setAutoAdvanceCountdown(1);

    autoAdvanceTimerRef.current = setTimeout(() => {
      setAutoAdvanceCountdown(null);
      advanceToNextCard();
    }, 1000);
  };

  // Manual rating handler
  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      setAutoAdvanceCountdown(null);
    }

    await onRecordReview(currentCard, rating, activeSheet);
    advanceToNextCard();
  };

  // Helper to convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Evaluate speech transcript & audio recording with Gemini AI backend
  const evaluateVoice = async (transcript: string, audioBlobOverride?: Blob) => {
    if (!currentCard) return;
    setIsEvaluating(true);
    try {
      let audioBase64: string | undefined;
      let audioMimeType = 'audio/webm';

      const blobToSend =
        audioBlobOverride ||
        (audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, {
              type: audioRecorderRef.current?.mimeType || 'audio/webm',
            })
          : null);

      if (blobToSend && blobToSend.size > 200) {
        audioMimeType = blobToSend.type || 'audio/webm';
        audioBase64 = await blobToBase64(blobToSend);
      }

      const res = await fetch('/api/evaluate-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHanzi: currentCard.hanzi,
          targetPinyin: currentCard.pinyin,
          recognizedText: transcript || '',
          audioBase64,
          audioMimeType,
        }),
      });

      if (res.ok) {
        const responseData = await res.json();
        const data: PronunciationEvaluation = responseData.evaluation || responseData;
        setEvalResult(data);
        if (data.isCorrect || data.accuracyScore >= 80) {
          confetti({
            particleCount: 50,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#10b981', '#3b82f6', '#f59e0b'],
          });
        }
      } else {
        // Fallback heuristic evaluation with structured syllables & mistake
        const chars = currentCard.hanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
        const pinyins = (currentCard.pinyin || '').split(/\s+/);
        const hasSpoken = Boolean(transcript && transcript.trim());
        const isMatch = hasSpoken && transcript.trim().toLowerCase().includes(currentCard.hanzi.trim().toLowerCase());

        if (!hasSpoken && (!blobToSend || blobToSend.size < 500)) {
          setEvalResult({
            accuracyScore: 0,
            pronunciationScore: 0,
            toneScore: 0,
            recognizedText: '(Chưa ghi nhận giọng đọc)',
            toneFeedback: 'Chưa phát hiện âm thanh.',
            tips: 'Hãy bấm micro và đọc to rõ ràng theo chữ Hán trên màn hình.',
            isCorrect: false,
            syllableDetails: chars.map((char, i) => ({
              char,
              pinyin: pinyins[i] || '',
              score: 0,
              status: 'needs_work',
            })),
            mistakeList: [
              {
                code: 'Im lặng',
                reason: 'Chưa ghi nhận được âm thanh. Hãy bấm micro và đọc to rõ ràng!',
              },
            ],
            mistakeDetail: 'Chưa thu được giọng đọc tiếng Trung.',
            correctionGuide: `Hãy nghe âm mẫu "${currentCard.hanzi}" (${currentCard.pinyin}) và đọc to theo.`,
          });
        } else {
          setEvalResult({
            accuracyScore: isMatch ? 90 : 25,
            pronunciationScore: isMatch ? 92 : 30,
            toneScore: isMatch ? 88 : 20,
            recognizedText: transcript || '(Âm thanh chưa rõ)',
            toneFeedback: isMatch ? 'Phát âm tương đối chuẩn!' : 'Cần phát âm rõ ràng hơn.',
            tips: 'Hãy nghe kỹ âm chuẩn bản xứ trước khi đọc.',
            isCorrect: isMatch,
            syllableDetails: chars.map((char, i) => ({
              char,
              pinyin: pinyins[i] || '',
              score: isMatch ? 92 : 25,
              status: isMatch ? 'perfect' : 'needs_work',
            })),
            mistakeList: isMatch
              ? []
              : [
                  {
                    code: 'Lệch âm',
                    reason: `Âm thu được "${transcript || 'chưa rõ'}" chưa chuẩn với "${currentCard.hanzi}" (${currentCard.pinyin})`,
                  },
                ],
            mistakeDetail: isMatch
              ? 'Phát âm chuẩn xác!'
              : `Cần luyện đọc lại theo chuẩn "${currentCard.hanzi}" (${currentCard.pinyin}).`,
            correctionGuide: 'Hãy nghe lại phát âm mẫu bản xứ và đọc to theo khẩu hình.',
          });
        }
      }
    } catch {
      const chars = currentCard.hanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c));
      const pinyins = (currentCard.pinyin || '').split(/\s+/);
      const hasSpoken = Boolean(transcript && transcript.trim());
      const isMatch = hasSpoken && transcript.trim().toLowerCase().includes(currentCard.hanzi.trim().toLowerCase());

      setEvalResult({
        accuracyScore: isMatch ? 90 : hasSpoken ? 25 : 0,
        pronunciationScore: isMatch ? 92 : hasSpoken ? 30 : 0,
        toneScore: isMatch ? 88 : hasSpoken ? 20 : 0,
        recognizedText: transcript || '(Chưa có âm thanh)',
        toneFeedback: isMatch ? 'Phát âm tương đối chuẩn!' : 'Cần phát âm rõ ràng hơn.',
        tips: 'Hãy nghe kỹ âm chuẩn bản xứ trước khi đọc.',
        isCorrect: isMatch,
        syllableDetails: chars.map((char, i) => ({
          char,
          pinyin: pinyins[i] || '',
          score: isMatch ? 92 : hasSpoken ? 25 : 0,
          status: isMatch ? 'perfect' : 'needs_work',
        })),
        mistakeList: isMatch
          ? []
          : [
              {
                code: hasSpoken ? 'Cần cải thiện' : 'Chưa có âm',
                reason: hasSpoken
                  ? `Âm thu được "${transcript}" chưa khớp với "${currentCard.hanzi}"`
                  : 'Chưa thu được giọng đọc. Hãy đọc to hơn.',
              },
            ],
        mistakeDetail: isMatch ? 'Phát âm chuẩn!' : 'Chưa đạt chuẩn phát âm.',
        correctionGuide: 'Hãy nghe âm mẫu và thử lại.',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Toggle Voice Recording with Gemini AI Pronunciation Check (PC Bluetooth & Mobile compatible)
  const handleToggleVoiceRecord = async () => {
    if (isListening) {
      // User tapped mic button to finish recording
      stopVoiceRecording();
      return;
    }

    if (!currentCard) return;

    // Reset previous recording state and ensure hardware tracks are cleared
    stopVoiceRecording();

    setIsListening(true);
    setMicTranscript('');
    micTranscriptRef.current = '';
    setEvalResult(null);
    audioChunksRef.current = [];

    // Pause any playing audio
    if (activeUserAudioRef.current) {
      try {
        activeUserAudioRef.current.pause();
        activeUserAudioRef.current = null;
      } catch {}
    }

    // 1. Capture user microphone for playback (Supports PC Bluetooth Headsets & Mobile)
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;

      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          options = { mimeType: 'audio/aac' };
        }
      }

      const mediaRecorder = options.mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        audioRecorderRef.current = null;

        // Single authoritative evaluation trigger with full audio blob
        evaluateVoice(micTranscriptRef.current, audioBlob);
      };

      mediaRecorder.start(200);
    } catch (err) {
      console.warn('Microphone stream access notice:', err);
    }

    // 2. Speech recognition listener
    const { stop: stopFn } = speechService.startListening(
      async (transcript: string, isFinal: boolean) => {
        setMicTranscript(transcript);
        micTranscriptRef.current = transcript;

        if (isFinal) {
          stopVoiceRecording();
        }
      },
      (error: any) => {
        console.warn('Speech recognition notice:', error);
        stopVoiceRecording();
      }
    );

    voiceRecorderRef.current = { stop: stopFn };
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlipCard();
      } else if (e.key === '1') {
        handleRate(1);
      } else if (e.key === '2') {
        handleRate(2);
      } else if (e.key === '3') {
        handleRate(3);
      } else if (e.key === '4') {
        handleRate(4);
      } else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'v') {
        handlePlayAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, currentCard, studyQueue, activeSheet]);

  // Restart completed session
  const handleRestart = () => {
    setCurrentIndex(0);
    setSessionCompleted(false);
    setAutoAdvanceCountdown(null);
    setupCardForIndex(0, studyQueue, studyMode);
  };

  // True Fisher-Yates Shuffle algorithm for uniform randomness
  const handleShuffle = () => {
    setIsShuffling(true);
    const source = deckCards.length > 0 ? [...deckCards] : [...studyQueue];
    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setStudyQueue(shuffled);
    setCurrentIndex(0);
    setSessionCompleted(false);
    setAutoAdvanceCountdown(null);
    setupCardForIndex(0, shuffled, studyMode);

    setShuffleNotification(`Đã xáo trộn ngẫu nhiên ${shuffled.length} từ vựng!`);
    setTimeout(() => {
      setIsShuffling(false);
    }, 450);
    setTimeout(() => {
      setShuffleNotification(null);
    }, 2400);
  };

  // Empty state if no cards in deck
  if (deckCards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-700 flex items-center justify-center">
          <BookA className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Bộ từ vựng này chưa có thẻ học</h2>
        <p className="text-stone-500 text-xs max-w-md mx-auto">
          {selectedTags.length > 0
            ? 'Không tìm thấy từ vựng nào khớp với các Tag đã chọn. Hãy bỏ lọc tag để xem các từ khác.'
            : 'Hãy thêm từ vựng mới hoặc chuyển sang bộ từ HSK hệ thống để bắt đầu ôn luyện.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={handleClearTags}
              className="px-4 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl transition-colors"
            >
              Bỏ lọc Tag
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToDecks}
            className="px-5 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-xl shadow-2xs transition-colors"
          >
            Quản Lý Bộ Từ
          </button>
        </div>
      </div>
    );
  }

  // Session Completed Summary Screen
  if (sessionCompleted) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center space-y-6 animate-in fade-in">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
          <Award className="w-10 h-10" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-stone-900">Hoàn Thành Buổi Ôn Tập!</h2>
          <p className="text-xs text-stone-600">
            Bạn đã ôn tập xong <strong>{studyQueue.length}</strong> từ vựng. Thuật toán Spaced Repetition (SM-2) đã lên lịch nhắc lại thời điểm vàng tiếp theo cho bạn.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            <span>Ôn Lại Bộ Này</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToDecks}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>Chọn Bộ Từ Khác</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      {/* Top Controls Bar: Deck Selector, 4 Study Modes & Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Deck Select Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor={currentDeckSelectId} className="text-xs font-semibold text-stone-500 shrink-0">
              Bộ từ:
            </label>
            <select
              id={currentDeckSelectId}
              value={currentDeckId}
              onChange={(e) => {
                setCurrentDeckId(e.target.value);
                setSelectedTags([]);
              }}
              className="text-xs font-bold text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              <option value="all">Tất cả bộ từ ({cards.length} từ)</option>
              <option value="weak_cards" className="font-bold text-red-700 bg-red-50">
                🚨 Sổ Tay Từ Hay Sai ({weakCards.length} từ)
              </option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({cards.filter((c) => c.deckId === d.id).length} từ)
                </option>
              ))}
            </select>
          </div>

          {/* Study Mode Selector (4 CHẾ ĐỘ HỌC CHUYÊN SÂU) */}
          <div className="flex items-center gap-2">
            <label htmlFor={studyModeSelectId} className="text-xs font-semibold text-stone-500 shrink-0">
              Chế độ:
            </label>
            <select
              id={studyModeSelectId}
              value={studyMode}
              onChange={(e) => {
                const newMode = e.target.value as StudyMode;
                setStudyMode(newMode);
                setupCardForIndex(currentIndex, studyQueue, newMode);
              }}
              className="text-xs font-bold text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              <option value="vietnamese_to_writing">✍️ Nhìn Nghĩa TV → Viết Hán Tự</option>
              <option value="audio_to_writing">🎧 Nghe Âm Đọc → Viết Hán Tự (Ẩn nghĩa)</option>
              <option value="hanzi_to_meaning">🗣️ Nhớ Nghĩa & Đọc (Hán → Nghĩa)</option>
              <option value="random">🔀 Toàn Diện (Ngẫu Nhiên Luân Phiên)</option>
            </select>
          </div>
        </div>

        {/* Actions (Shuffle & Guide) */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={isShuffling || studyQueue.length <= 1}
            className={`p-2 sm:px-3 sm:py-1.5 text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold shadow-2xs ${
              isShuffling ? 'scale-95 bg-stone-200 opacity-80' : 'active:scale-95'
            }`}
            title="Trộn ngẫu nhiên thứ tự toàn bộ từ vựng theo thuật toán Fisher-Yates"
          >
            <Shuffle className={`w-3.5 h-3.5 text-amber-700 transition-transform duration-300 ${isShuffling ? 'rotate-180 scale-125' : ''}`} />
            <span className="hidden sm:inline">Trộn ngẫu nhiên</span>
          </button>

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="p-2 sm:px-3 sm:py-1.5 text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Hướng dẫn</span>
            </button>
          )}
        </div>
      </div>

      {/* Shuffle Notification Toast */}
      {shuffleNotification && (
        <div className="p-2.5 px-4 bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>✓ {shuffleNotification}</span>
          </div>
          <span className="text-[11px] text-emerald-100 font-normal">Đã bắt đầu từ thẻ #1</span>
        </div>
      )}

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

      {/* WEAK CARDS CALLOUT BANNER IF ANY WEAK CARDS EXIST */}
      {currentDeckId === 'weak_cards' ? (
        <div className="p-3.5 bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl border border-red-200/90 shadow-2xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold text-red-900 block">Đang Ôn Luyện: Sổ Tay Từ Hay Sai ({studyQueue.length} từ)</span>
              <span className="text-[11px] text-stone-600">
                Hãy tập trung sửa lỗi phát âm và luyện viết các nét chữ bạn còn hay quên.
              </span>
            </div>
          </div>
          {openWeakCardsModal && (
            <button
              type="button"
              onClick={openWeakCardsModal}
              className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-800 font-bold text-xs hover:bg-red-50 transition-colors shrink-0"
            >
              Xem danh sách
            </button>
          )}
        </div>
      ) : weakCards.length > 0 && openWeakCardsModal ? (
        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 shadow-2xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-amber-900 font-medium">
              Bạn có <strong>{weakCards.length}</strong> từ hay sai cần ôn lại.
            </span>
          </div>
          <button
            type="button"
            onClick={openWeakCardsModal}
            className="text-amber-900 font-bold hover:underline shrink-0 text-xs"
          >
            Mở Sổ Tay Từ Khó →
          </button>
        </div>
      ) : null}

      {/* =========================================================================
          UNIFIED 1-DIV CONTAINER (GỘP ĐỌC VÀ VIẾT VÀO 1 CARD CÓ 2 SHEET)
         ========================================================================= */}
      {currentCard && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-7 space-y-5 animate-in fade-in transition-all">
          {/* Card Header: Overall Word Counter + 2 Sheets Switcher Pills & Native Audio */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            {/* Left side: Overall word position badge ("Từ 1 / 334") + 2 Sheets Toggle Tabs */}
            <div className="flex items-center flex-wrap gap-2.5">
              {/* REQUIREMENT: Đưa phần 1 / 334 từ ra ngoài gần phần tiêu đề sheet */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-900 border border-red-200/80 font-bold text-xs shadow-2xs">
                <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Từ</span>
                <span className="font-mono text-sm text-red-700">{currentIndex + 1}</span>
                <span className="text-red-400 font-normal">/</span>
                <span className="font-mono text-stone-600">{studyQueue.length}</span>
              </div>

              {/* 2 Sheets Toggle Tabs */}
              <div className="flex items-center p-1 bg-stone-100 rounded-2xl border border-stone-200/80">
                <button
                  type="button"
                  onClick={() => setActiveSheet('writing')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeSheet === 'writing'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5 text-amber-700" />
                  <span>✍️ Sheet 1: Luyện Viết</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('reading')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeSheet === 'reading'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-red-700" />
                  <span>🗣️ Sheet 2: Luyện Đọc & Phát Âm</span>
                </button>
              </div>

              {/* Mode indicator badge when in Random/Comprehensive mode */}
              {studyMode === 'random' && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold shadow-2xs animate-in fade-in">
                  <Shuffle className="w-3 h-3 text-amber-700" />
                  <span>
                    Mục tiêu: {currentEffectiveMode === 'vietnamese_to_writing'
                      ? '✍️ Nhìn nghĩa TV → Viết'
                      : currentEffectiveMode === 'hanzi_to_meaning'
                      ? '🗣️ Nhớ nghĩa & Luyện Đọc'
                      : '🎧 Nghe âm → Viết (Ẩn nghĩa)'}
                  </span>
                </div>
              )}
            </div>

            {/* Right side: Actions (Pin to Weak Cards & Listen Standard Voice) */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {onToggleWeakStatus && (
                <button
                  type="button"
                  onClick={() => onToggleWeakStatus(currentCard.id, !currentCard.isWeak)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                    currentCard.isWeak
                      ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 shadow-2xs'
                      : 'text-stone-400 hover:text-stone-700 hover:bg-stone-50 border border-transparent'
                  }`}
                  title={currentCard.isWeak ? 'Bỏ ghim khỏi Sổ tay từ khó' : 'Ghim vào Sổ tay từ hay sai / từ khó'}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${currentCard.isWeak ? 'text-red-600 fill-red-100' : ''}`} />
                  <span className="hidden sm:inline">{currentCard.isWeak ? 'Từ khó' : 'Ghim khó'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handlePlayAudio(currentCard.hanzi)}
                className={`p-2 rounded-xl transition-all duration-150 flex items-center gap-1.5 text-xs font-semibold shrink-0 active:scale-90 active:ring-4 active:ring-red-300 cursor-pointer ${
                  isPlayingStandardAudio
                    ? 'bg-red-100 text-red-800 ring-2 ring-red-400 scale-105 shadow-sm'
                    : 'text-stone-500 hover:text-red-700 hover:bg-stone-50'
                }`}
                title="Nghe phát âm chuẩn người bản xứ"
              >
                <Volume2 className={`w-4 h-4 text-red-700 ${isPlayingStandardAudio ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">{isPlayingStandardAudio ? 'Đang đọc...' : 'Phát âm chuẩn'}</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              SHEET 1: TẬP VIẾT CHỮ HÁN (Hanzi Canvas & Stroke Practice)
              - TỰ ĐỘNG THÍCH ỨNG THEO CHẾ ĐỘ: "Nhìn Nghĩa TV → Viết" HOẶC "Nghe Âm → Viết (Ẩn nghĩa)"
             ========================================================================= */}
          {activeSheet === 'writing' && (
            <div className="space-y-4 animate-in fade-in">
              {/* KHUNG HIỂN THỊ NGHĨA HOẶC NÚT NGHE ÂM THEO CHẾ ĐỘ ĐANG CHỌN */}
              {currentEffectiveMode === 'audio_to_writing' ? (
                /* CHẾ ĐỘ 2: NGHE ÂM ĐỌC → VIẾT HÁN TỰ (ẨN NGHĨA MẶC ĐỊNH) */
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-center space-y-3 shadow-2xs animate-in fade-in">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    🎧 Chế độ Nghe - Viết (Nghe âm đọc & nhớ cách viết)
                  </span>

                  {/* Nút bấm to để nghe lại âm thanh */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handlePlayAudio(currentCard.hanzi)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md transition-all duration-150 active:scale-90 active:ring-4 active:ring-emerald-300 cursor-pointer ${
                        isPlayingStandardAudio
                          ? 'bg-emerald-800 text-white ring-4 ring-emerald-400 scale-105'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white hover:scale-102'
                      }`}
                    >
                      <Volume2 className={`w-4 h-4 ${isPlayingStandardAudio ? 'animate-bounce' : ''}`} />
                      <span>{isPlayingStandardAudio ? '🔊 Đang phát âm...' : '🔊 Bấm để nghe phát âm'}</span>
                    </button>
                  </div>

                  {/* Nút hỗ trợ mở xem Nghĩa Tiếng Việt nếu lỡ quên */}
                  <div>
                    {!showWritingMeaning ? (
                      <button
                        type="button"
                        onClick={() => setShowWritingMeaning(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-all shadow-2xs"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>💡 Nhấn để xem Nghĩa Tiếng Việt (Hỗ trợ)</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 pt-1 animate-in fade-in">
                        <div className="text-lg sm:text-xl font-bold text-stone-900 font-vietnamese">
                          {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowWritingMeaning(false)}
                          className="text-[11px] text-stone-500 hover:text-stone-800 underline"
                        >
                          Ẩn nghĩa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 1: NHÌN NGHĨA TIẾNG VIỆT HOẶC GỢI Ý NGỮ CẢNH → VIẾT HÁN TỰ */
                currentCard.contextClue ? (
                  <div className="p-4 bg-gradient-to-b from-[#fbf9f5] to-[#f8f6f0] rounded-2xl border border-amber-200/90 text-center space-y-3 shadow-2xs animate-in fade-in">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 text-[11px] font-bold shadow-2xs">
                      <span>🧩 Gợi ý ngữ cảnh / Câu đố suy luận</span>
                    </div>

                    {/* Đoạn mô tả ngữ cảnh để tự suy luận ra từ */}
                    <p className="text-sm sm:text-base font-semibold text-stone-800 leading-relaxed max-w-xl mx-auto font-vietnamese">
                      "{currentCard.contextClue}"
                    </p>

                    {/* Nút hiển thị nghĩa tiếng Việt cốt lõi */}
                    <div>
                      {!showWritingMeaning ? (
                        <button
                          type="button"
                          onClick={() => setShowWritingMeaning(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-stone-800 bg-white hover:bg-stone-50 border border-stone-200 hover:border-amber-400 transition-all duration-150 shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>👁️ Hiển thị nghĩa tiếng Việt</span>
                        </button>
                      ) : (
                        <div className="pt-2 border-t border-stone-200/80 space-y-1.5 animate-in fade-in">
                          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                            Nghĩa chính xác:
                          </span>
                          <h3 className="text-2xl sm:text-3xl font-bold text-red-900 font-vietnamese">
                            {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowWritingMeaning(false)}
                            className="text-[11px] text-stone-500 hover:text-stone-800 underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff className="w-3 h-3" />
                            <span>Ẩn nghĩa tiếng Việt</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#fbf9f5] rounded-2xl border border-stone-200/90 text-center space-y-1 shadow-2xs animate-in fade-in">
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                      Nghĩa Tiếng Việt (Hãy nhớ và viết chữ Hán tương ứng)
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 font-vietnamese">
                      {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                    </h3>
                  </div>
                )
              )}

              {/* Khung ô tập viết chữ Mễ (米字格) */}
              <div className="bg-[#faf9f5] p-4 rounded-3xl border border-stone-200/90 space-y-3">
                {/* Writing Hint Toggle (Gợi ý mặt chữ khi tập viết nếu quên) */}
                <div className="flex items-center justify-between pb-1 border-b border-stone-200/60 text-xs">
                  <span className="font-semibold text-stone-600">Ô tập viết chữ Mễ (米字格)</span>
                  {!showWritingHint ? (
                    <button
                      type="button"
                      onClick={() => setShowWritingHint(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-all"
                    >
                      <Lightbulb className="w-3 h-3 text-amber-700" />
                      <span>💡 Gợi ý mặt chữ & Pinyin</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2">
                      <span className="font-hanzi font-bold text-stone-900 text-sm">{currentCard.hanzi}</span>
                      <span className="font-mono text-xs text-red-700 font-semibold bg-white px-2 py-0.5 rounded border border-red-200">{currentCard.pinyin}</span>
                      <button
                        type="button"
                        onClick={() => setShowWritingHint(false)}
                        className="text-[10px] text-stone-500 hover:text-stone-800 underline ml-1"
                      >
                        Ẩn
                      </button>
                    </div>
                  )}
                </div>

                {/* Calligraphy Writing Canvas (米字格) */}
                <div className="py-2 flex justify-center">
                  <HanziCanvas
                    key={`canvas-unified-${currentCard.id}`}
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

                {/* Auto-advance countdown notification */}
                {autoAdvanceCountdown !== null && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-bounce">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Xuất sắc! Viết đúng 100% — Tự động chuyển từ tiếp theo...</span>
                    </span>
                    <span className="text-[11px] text-emerald-700">✓ SM-2 5 sao</span>
                  </div>
                )}
              </div>

              {/* SM-2 Rating Bar for Writing Sheet */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span>Đánh giá mức độ ghi nhớ (Spaced Repetition SM-2):</span>
                  <span className="text-[11px] text-stone-400">Phím tắt: 1, 2, 3, 4</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate(1)}
                    className="py-2.5 px-3 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold transition-all text-center hover:scale-102"
                  >
                    <div>Chưa nhớ (Lại)</div>
                    <div className="text-[10px] text-red-600 font-normal mt-0.5">1 ngày (Ôn lại)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(2)}
                    className="py-2.5 px-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold transition-all text-center hover:scale-102"
                  >
                    <div>Khó nhớ</div>
                    <div className="text-[10px] text-orange-600 font-normal mt-0.5">
                      {formatInterval(Math.max(1, Math.round((currentCard.interval || 1) * 1.2)))}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(3)}
                    className="py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all text-center hover:scale-102"
                  >
                    <div>Tốt (Đã nhớ)</div>
                    <div className="text-[10px] text-emerald-600 font-normal mt-0.5">
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
                    className="py-2.5 px-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold transition-all text-center hover:scale-102"
                  >
                    <div>Rất dễ (Thuộc làu)</div>
                    <div className="text-[10px] text-blue-600 font-normal mt-0.5">
                      {formatInterval(
                        Math.round((currentCard.interval || 1) * (currentCard.easeFactor || 2.5) * 1.3)
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Example sentence if available */}
              {currentCard.exampleSentence && (
                <div className="mt-2 p-3 bg-stone-50 rounded-2xl border border-stone-200/80 text-left text-xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500 font-semibold">
                    <span>Câu ví dụ:</span>
                    <button
                      type="button"
                      onClick={() => handlePlayAudio(currentCard.exampleSentence)}
                      className="p-1 hover:text-red-700"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-red-700" />
                    </button>
                  </div>
                  <p className="font-hanzi font-semibold text-stone-900 text-sm">{currentCard.exampleSentence}</p>
                  {currentCard.examplePinyin && <p className="text-stone-500 font-mono">{currentCard.examplePinyin}</p>}
                  {currentCard.exampleMeaning && <p className="text-stone-600 italic">{currentCard.exampleMeaning}</p>}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              SHEET 2: LUYỆN ĐỌC & PHÁT ÂM AI (Speech Recognition & Evaluation)
              - ẨN PINYIN VÀ ẨN NGHĨA TIẾNG VIỆT ĐỂ NGƯỜI HỌC TỰ NHỚ & ĐỌC CHỮ HÁN
             ========================================================================= */}
          {activeSheet === 'reading' && (
            <div className="space-y-4 animate-in fade-in">
              {/* TWO SCORES WIDGET: Âm và thanh điệu kèm lý do (As shown in screenshot) */}
              <div className="bg-[#f7f6f2] p-4 rounded-2xl border border-stone-200/80 flex items-center gap-4 sm:gap-6">
                {/* Overall circular score */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-stone-200"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {evalResult && (
                      <path
                        className={
                          evalResult.accuracyScore >= 80
                            ? 'text-emerald-500'
                            : evalResult.accuracyScore >= 60
                            ? 'text-amber-500'
                            : 'text-red-500'
                        }
                        strokeDasharray={`${evalResult.accuracyScore}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className={`text-xl sm:text-2xl font-bold font-mono ${
                        evalResult
                          ? evalResult.accuracyScore >= 80
                            ? 'text-emerald-600'
                            : evalResult.accuracyScore >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                          : 'text-stone-400'
                      }`}
                    >
                      {evalResult !== null ? evalResult.accuracyScore : '—'}
                    </span>
                  </div>
                </div>

                {/* 2 Detailed Scores: Phát âm & Thanh điệu */}
                <div className="flex-1 space-y-2.5">
                  {/* Score 1: Phát âm */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                      <span>Phát âm</span>
                      <span className="font-mono font-bold text-stone-900">
                        {evalResult !== null ? `${evalResult.pronunciationScore}đ` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (evalResult?.pronunciationScore ?? 0) >= 80
                            ? 'bg-emerald-500'
                            : (evalResult?.pronunciationScore ?? 0) >= 60
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${evalResult?.pronunciationScore ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Score 2: Thanh điệu */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                      <span>Thanh điệu</span>
                      <span className="font-mono font-bold text-stone-900">
                        {evalResult !== null ? `${evalResult.toneScore}đ` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (evalResult?.toneScore ?? 0) >= 80
                            ? 'bg-emerald-500'
                            : (evalResult?.toneScore ?? 0) >= 60
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${evalResult?.toneScore ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BIG HANZI DISPLAY: Characters with colored underline, pinyin (HIDDEN BY DEFAULT) and individual syllable scores */}
              <div className="text-center py-2 space-y-3">
                {/* Legend & Pinyin Support Toggle Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-stone-500 pb-1 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <strong className="text-emerald-800">Xanh:</strong> Đọc đúng
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                      <strong className="text-red-800">Đỏ:</strong> Chưa đúng
                    </span>
                  </div>

                  {/* REQUIREMENT: Nút hỗ trợ hiện/ẩn Pinyin trong phần luyện đọc */}
                  {!showReadingPinyin ? (
                    <button
                      type="button"
                      onClick={() => setShowReadingPinyin(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-700" />
                      <span>💡 Hiện Pinyin hỗ trợ</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowReadingPinyin(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 border border-stone-200 transition-all"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Ẩn Pinyin</span>
                    </button>
                  )}
                </div>

                {/* Character syllables row */}
                <div className="flex items-end justify-center gap-6 sm:gap-10 pt-2">
                  {currentCard.hanzi.split('').map((char, idx) => {
                    const pinyinParts = (currentCard.pinyin || '').split(/\s+/);
                    const charPinyin = pinyinParts[idx] || '';
                    const sylDetail = evalResult?.syllableDetails?.[idx];

                    // Determine if this syllable was read correctly
                    const hasEvaluated = !!evalResult;
                    const isCorrectSyllable = hasEvaluated
                      ? sylDetail?.status === 'perfect' ||
                        sylDetail?.status === 'good' ||
                        (sylDetail?.score !== undefined && sylDetail.score >= 70)
                      : null;

                    // Underline color: Xanh lá nếu đọc đúng, Đỏ nếu đọc sai, Xám nhẹ nếu chưa thu âm
                    const underlineClass =
                      isCorrectSyllable === true
                        ? 'bg-emerald-500 shadow-xs'
                        : isCorrectSyllable === false
                        ? 'bg-red-500 shadow-xs ring-2 ring-red-200'
                        : 'bg-stone-300';

                    const textClass =
                      isCorrectSyllable === true
                        ? 'text-emerald-700'
                        : isCorrectSyllable === false
                        ? 'text-red-700'
                        : 'text-stone-800';

                    const charClass =
                      isCorrectSyllable === true
                        ? 'text-emerald-950 font-bold'
                        : isCorrectSyllable === false
                        ? 'text-red-950 font-bold'
                        : 'text-stone-900';

                    return (
                      <div key={idx} className="flex flex-col items-center">
                        {/* Hanzi Character */}
                        <div className={`text-4xl sm:text-5xl font-hanzi mb-1.5 transition-colors ${charClass}`}>
                          {char}
                        </div>

                        {/* Colored Underline (Gạch xanh = Đọc đúng, Gạch đỏ = Đọc chưa chuẩn) */}
                        <div className={`w-14 sm:w-18 h-1.5 rounded-full mb-1.5 transition-all duration-300 ${underlineClass}`} />

                        {/* Pinyin (ẨN ĐI NẾU CHƯA ẤN NÚT HỖ TRỢ) */}
                        {showReadingPinyin ? (
                          <div className={`text-base sm:text-lg font-bold font-mono transition-colors animate-in fade-in ${textClass}`}>
                            {charPinyin}
                          </div>
                        ) : (
                          <div className="text-xs font-mono font-medium text-stone-300 py-1">
                            ••••
                          </div>
                        )}

                        {/* Syllable Accuracy Badge */}
                        {hasEvaluated && (
                          <div className="mt-1">
                            {isCorrectSyllable ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span>✓</span>
                                <span>{sylDetail?.score ?? 85}đ</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-red-100 text-red-800 border border-red-300">
                                <span>✗</span>
                                <span>{sylDetail?.score ?? 45}đ</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DETAILED PHONETIC MISTAKE BREAKDOWN LIST (Matching Screenshot) */}
              {evalResult?.mistakeList && evalResult.mistakeList.length > 0 ? (
                <div className="space-y-2 animate-in fade-in">
                  <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                    Phân tích chi tiết lỗi sai:
                  </div>
                  {evalResult.mistakeList.map((err, i) => (
                    <div
                      key={i}
                      className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center gap-3 text-xs leading-relaxed"
                    >
                      <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-mono font-bold shrink-0 text-xs border border-red-200">
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

              {/* AI Coaching & Pronunciation Tips */}
              {evalResult && (evalResult.correctionGuide || evalResult.tips) && (
                <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Mẹo sửa lỗi & Hướng dẫn khẩu hình AI:</span>
                  </div>
                  {evalResult.correctionGuide && (
                    <p className="text-stone-700 leading-relaxed">
                      👉 <strong>Cách đọc:</strong> {evalResult.correctionGuide}
                    </p>
                  )}
                  {evalResult.tips && (
                    <p className="text-stone-600 leading-relaxed italic">
                      💡 <strong>Mẹo:</strong> {evalResult.tips}
                    </p>
                  )}
                </div>
              )}

              {/* AUDIO CONTROLS (Play User Recording & Play Native Pronunciation) */}
              <div className="flex items-center justify-center gap-3 pt-1">
                {/* Button 1: Bản ghi của bạn */}
                <button
                  type="button"
                  onClick={handlePlayUserAudio}
                  disabled={!recordedAudioUrl || isPlayingRecordedAudio}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 shadow-2xs cursor-pointer active:scale-90 active:ring-4 active:ring-stone-400 ${
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 shadow-2xs cursor-pointer active:scale-90 active:ring-4 active:ring-red-300 ${
                    isPlayingStandardAudio
                      ? 'bg-red-100 text-red-800 border-2 border-red-400 ring-2 ring-red-400 scale-105 shadow-sm'
                      : 'bg-white text-stone-800 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Volume2 className={`w-4 h-4 text-red-700 ${isPlayingStandardAudio ? 'animate-bounce' : ''}`} />
                  <span>{isPlayingStandardAudio ? 'Đang đọc...' : 'Nghe bản xứ'}</span>
                </button>
              </div>

              {/* BIG CIRCULAR MICROPHONE BUTTON AT THE BOTTOM (Matching Screenshot) */}
              <div className="flex flex-col items-center justify-center pt-2 pb-1 space-y-1.5">
                <button
                  type="button"
                  onClick={handleToggleVoiceRecord}
                  disabled={isEvaluating}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 active:scale-85 active:ring-8 cursor-pointer ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-300'
                      : 'bg-stone-950 text-white hover:bg-stone-900 active:ring-stone-400'
                  }`}
                  title={isListening ? 'Bấm để dừng và chấm điểm' : 'Bấm để bắt đầu thu âm phát âm'}
                >
                  {isListening ? (
                    <Square className="w-5 h-5 fill-current" />
                  ) : (
                    <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
                  )}
                </button>
                <div className="text-[11px] text-stone-500 font-medium text-center">
                  {isListening
                    ? '🎤 Đang nghe... Đọc xong dừng 1s hoặc chạm để chấm điểm'
                    : isEvaluating
                    ? 'Đang phân tích ngữ âm AI...'
                    : 'Chạm micro để thu âm phát âm và chấm điểm'}
                </div>
              </div>

              {/* SM-2 Rating Bar for Reading Sheet */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span>Đánh giá mức độ ghi nhớ (Spaced Repetition SM-2):</span>
                  <span className="text-[11px] text-stone-400">Phím tắt: 1, 2, 3, 4</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate(1)}
                    className="py-2.5 px-3 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold transition-all duration-150 text-center active:scale-90 active:ring-4 active:ring-red-300 cursor-pointer shadow-2xs hover:scale-102"
                  >
                    <div>Chưa nhớ (Lại)</div>
                    <div className="text-[10px] text-red-600 font-normal mt-0.5">1 ngày (Ôn lại)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(2)}
                    className="py-2.5 px-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-bold transition-all duration-150 text-center active:scale-90 active:ring-4 active:ring-orange-300 cursor-pointer shadow-2xs hover:scale-102"
                  >
                    <div>Khó nhớ</div>
                    <div className="text-[10px] text-orange-600 font-normal mt-0.5">
                      {formatInterval(Math.max(1, Math.round((currentCard.interval || 1) * 1.2)))}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(3)}
                    className="py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all duration-150 text-center active:scale-90 active:ring-4 active:ring-emerald-300 cursor-pointer shadow-2xs hover:scale-102"
                  >
                    <div>Tốt (Đã nhớ)</div>
                    <div className="text-[10px] text-emerald-600 font-normal mt-0.5">
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
                    className="py-2.5 px-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold transition-all duration-150 text-center active:scale-90 active:ring-4 active:ring-blue-300 cursor-pointer shadow-2xs hover:scale-102"
                  >
                    <div>Rất dễ (Thuộc làu)</div>
                    <div className="text-[10px] text-blue-600 font-normal mt-0.5">
                      {formatInterval(
                        Math.round((currentCard.interval || 1) * (currentCard.easeFactor || 2.5) * 1.3)
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* REQUIREMENT: Ở Sheet Luyện Đọc, Nghĩa Tiếng Việt ẨN MẶC ĐỊNH, chỉ hiện khi ấn xem */}
              <div className="p-4 bg-[#fbf9f5] rounded-2xl border border-stone-200/90 text-center space-y-2">
                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                  Nghĩa Tiếng Việt
                </span>

                {!showReadingMeaning ? (
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => setShowReadingMeaning(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-100/80 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 transition-all shadow-2xs hover:scale-102"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-700" />
                      <span>💡 Nhấn để xem Nghĩa Tiếng Việt (Kiểm tra trí nhớ)</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in">
                    <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 font-vietnamese">
                      {currentCard.meaning ? currentCard.meaning.normalize('NFC') : ''}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowReadingMeaning(false)}
                      className="text-[11px] text-stone-400 hover:text-stone-700 underline font-medium"
                    >
                      Ẩn nghĩa
                    </button>
                  </div>
                )}

                {/* Example sentence in Reading sheet (Revealed when meaning is shown) */}
                {showReadingMeaning && currentCard.exampleSentence && (
                  <div className="mt-3 p-3 bg-white rounded-2xl border border-stone-200/80 text-left text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between text-stone-500 font-semibold">
                      <span>Câu ví dụ:</span>
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(currentCard.exampleSentence)}
                        className="p-1 hover:text-red-700"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-red-700" />
                      </button>
                    </div>
                    <p className="font-hanzi font-semibold text-stone-900 text-sm">{currentCard.exampleSentence}</p>
                    {currentCard.examplePinyin && <p className="text-stone-500 font-mono">{currentCard.examplePinyin}</p>}
                    {currentCard.exampleMeaning && <p className="text-stone-600 italic">{currentCard.exampleMeaning}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
