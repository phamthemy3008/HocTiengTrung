import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import HanziWriter from 'hanzi-writer';
import {
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Play,
  Square,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { speechService } from '../services/speech';

interface HanziCanvasProps {
  targetHanzi?: string;
  showGhostByDefault?: boolean;
  hideCharacterPrompt?: boolean;
  onStrokeDrawn?: () => void;
  onCharacterCompleted?: (isSuccess: boolean) => void;
  className?: string;
}

export const HanziCanvas: React.FC<HanziCanvasProps> = ({
  targetHanzi = '',
  showGhostByDefault = false,
  hideCharacterPrompt = true,
  onStrokeDrawn,
  onCharacterCompleted,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const writerDomRef = useRef<HTMLDivElement | null>(null);
  const writerInstanceRef = useRef<HanziWriter | null>(null);

  // Split into individual Chinese characters
  const characters = useMemo(() => {
    if (!targetHanzi) return ['好'];
    const matched = targetHanzi.match(/[\u4e00-\u9fa5]/g);
    return matched && matched.length > 0 ? matched : [targetHanzi.charAt(0) || '好'];
  }, [targetHanzi]);

  const [selectedCharIndex, setSelectedCharIndex] = useState<number>(0);
  const currentChar = characters[selectedCharIndex] || characters[0] || '好';
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());

  const charIndexRef = useRef(selectedCharIndex);
  charIndexRef.current = selectedCharIndex;
  const charactersRef = useRef(characters);
  charactersRef.current = characters;

  const [canvasSize, setCanvasSize] = useState<number>(290);
  const [showGhost, setShowGhost] = useState<boolean>(showGhostByDefault);
  const [isDemonstrating, setIsDemonstrating] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [shakeError, setShakeError] = useState<boolean>(false);
  const [isHintShown, setIsHintShown] = useState<boolean>(false);

  const [currentStrokeIndex, setCurrentStrokeIndex] = useState<number>(0);
  const [totalStrokes, setTotalStrokes] = useState<number>(0);
  const [strokeFeedback, setStrokeFeedback] = useState<{
    type: 'success' | 'error' | 'hint' | 'complete';
    message: string;
  } | null>(null);

  // Reset character selection when targetHanzi word changes
  useEffect(() => {
    setSelectedCharIndex(0);
    setCompletedIndices(new Set());
    setIsCompleted(false);
    setIsHintShown(false);
  }, [targetHanzi]);

  // Resize canvas responsively
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const size = Math.min(Math.max(width - 24, 240), 340);
        setCanvasSize(size);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Start the interactive stroke-by-stroke quiz on the writer
  const startQuiz = useCallback((writer: HanziWriter, char: string) => {
    setIsDemonstrating(false);
    setIsCompleted(false);
    setCurrentStrokeIndex(0);
    setStrokeFeedback({
      type: 'hint',
      message: hideCharacterPrompt
        ? 'Hãy tự nhớ mặt chữ và viết từng nét theo đúng quy tắc bút thuận.'
        : `Hãy viết từng nét của chữ "${char}" theo đúng quy tắc bút thuận.`,
    });

    writer.quiz({
      onMistake: (strokeData) => {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        setStrokeFeedback({
          type: 'error',
          message: `Sai thứ tự hoặc sai nét! Cần viết nét thứ ${strokeData.strokeNum + 1}. Nét sai đã được xóa, hãy quan sát và viết lại.`,
        });
      },
      onCorrectStroke: (strokeData) => {
        const next = strokeData.strokeNum + 1;
        setCurrentStrokeIndex(next);
        setStrokeFeedback({
          type: 'success',
          message: `✓ Khớp chuẩn nét ${next}! Tiếp tục nét tiếp theo.`,
        });
        if (onStrokeDrawn) onStrokeDrawn();
      },
      onComplete: () => {
        const curIdx = charIndexRef.current;
        const allChars = charactersRef.current;
        const isLastChar = curIdx >= allChars.length - 1;

        // Mark this character as completed in set
        setCompletedIndices((prev) => {
          const nextSet = new Set(prev);
          nextSet.add(curIdx);
          return nextSet;
        });

        speechService.speak(char);

        if (!isLastChar) {
          // Completed an intermediate character of a multi-character word (e.g. chữ 1 trong 谢谢)
          setStrokeFeedback({
            type: 'complete',
            message: hideCharacterPrompt
              ? `✓ Xuất sắc! Đã viết đúng chữ thứ ${curIdx + 1}/${allChars.length}. Đang tự động chuyển sang chữ thứ ${curIdx + 2}...`
              : `✓ Xuất sắc! Đã viết đúng chữ "${char}" (${curIdx + 1}/${allChars.length}). Đang tự động chuyển sang chữ thứ ${curIdx + 2} ("${allChars[curIdx + 1]}")...`,
          });

          try {
            confetti({
              particleCount: 30,
              spread: 50,
              origin: { y: 0.6 },
              colors: ['#059669', '#10b981', '#34d399'],
            });
          } catch {}

          // Automatically switch to the remaining character after 850ms
          setTimeout(() => {
            setSelectedCharIndex(curIdx + 1);
          }, 850);
        } else {
          // Completed all characters of the word or single character
          setIsCompleted(true);
          setStrokeFeedback({
            type: 'complete',
            message: `Xuất sắc! Bạn đã viết hoàn thành toàn bộ ${
              allChars.length > 1
                ? `${allChars.length} chữ của từ "${targetHanzi}"`
                : `các nét của chữ "${char}"`
            } đúng chuẩn bút thuận!`,
          });

          try {
            confetti({
              particleCount: 50,
              spread: 65,
              origin: { y: 0.6 },
              colors: ['#b91c1c', '#d97706', '#059669'],
            });
          } catch {}

          if (allChars.length > 1) {
            setTimeout(() => {
              speechService.speak(targetHanzi);
            }, 300);
          }

          if (onCharacterCompleted) onCharacterCompleted(true);
        }
      },
    });
  }, [onCharacterCompleted, onStrokeDrawn, targetHanzi]);

  // Initialize or re-create HanziWriter when character or canvasSize changes
  useEffect(() => {
    if (!writerDomRef.current) return;

    // Clear previous DOM contents
    writerDomRef.current.innerHTML = '';
    writerInstanceRef.current = null;

    try {
      const writer = HanziWriter.create(writerDomRef.current, currentChar, {
        width: canvasSize,
        height: canvasSize,
        padding: 16,
        showOutline: showGhost,
        showCharacter: false, // hide character initially so user writes it
        strokeAnimationSpeed: 1.1,
        delayBetweenStrokes: 260,
        strokeColor: '#1c1917', // authentic deep calligraphy black ink
        outlineColor: 'rgba(180, 83, 9, 0.18)', // faint vermilion guide outline
        drawingColor: '#1c1917', // stroke drawn color
        drawingWidth: Math.max(12, canvasSize * 0.048),
        showHintAfterMisses: 2, // show hint if user misses twice
        highlightOnComplete: true,
        charDataLoader: (char, onComplete, onErr) => {
          fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`)
            .then((res) => {
              if (!res.ok) throw new Error('Data not found');
              return res.json();
            })
            .then((data) => {
              if (data && Array.isArray(data.strokes)) {
                setTotalStrokes(data.strokes.length);
              }
              onComplete(data);
            })
            .catch((err) => {
              if (onErr) onErr(err);
            });
        },
      });

      writerInstanceRef.current = writer;

      // Start quiz mode so user can write each stroke in order
      startQuiz(writer, currentChar);
    } catch (e) {
      console.error('Failed to initialize HanziWriter:', e);
    }

    return () => {
      if (writerInstanceRef.current) {
        writerInstanceRef.current.cancelQuiz();
      }
    };
  }, [currentChar, canvasSize, showGhost, startQuiz]);

  // Handle "Hiển thị cách viết" (Animate entire character stroke by stroke)
  const handleToggleDemonstration = () => {
    const writer = writerInstanceRef.current;
    if (!writer) return;

    if (isDemonstrating) {
      // Stop demonstration and reset back to writing practice
      writer.cancelQuiz();
      startQuiz(writer, currentChar);
      return;
    }

    // Start demonstration
    setIsDemonstrating(true);
    setIsCompleted(false);
    writer.cancelQuiz();
    writer.hideCharacter();

    setStrokeFeedback({
      type: 'hint',
      message: `Đang hiển thị chuẩn xác từng nét của chữ "${currentChar}"...`,
    });

    writer.animateCharacter({
      onComplete: () => {
        setIsDemonstrating(false);
        setStrokeFeedback({
          type: 'complete',
          message: `Đã hoàn tất hướng dẫn cách viết chữ "${currentChar}"! Giờ đến lượt bạn tự mình luyện tập.`,
        });
        speechService.speak(currentChar);
        // Restart quiz for user practice
        setTimeout(() => {
          if (writerInstanceRef.current) {
            writerInstanceRef.current.hideCharacter();
            startQuiz(writerInstanceRef.current, currentChar);
          }
        }, 1200);
      },
    });
  };

  // Reset to write again
  const handleReset = () => {
    const writer = writerInstanceRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    writer.hideCharacter();
    startQuiz(writer, currentChar);
  };

  // Toggle ghost outline
  const handleToggleGhost = () => {
    const newGhost = !showGhost;
    setShowGhost(newGhost);
    if (writerInstanceRef.current) {
      if (newGhost) {
        writerInstanceRef.current.showOutline();
      } else {
        writerInstanceRef.current.hideOutline();
      }
    }
  };

  const handleListenPronunciation = () => {
    speechService.speak(currentChar);
  };

  return (
    <div ref={containerRef} className={`flex flex-col items-center select-none ${className}`}>
      {/* Top Header: Multi-character tabs (if word has >1 Hanzi) & Stroke Progress */}
      <div className="flex items-center justify-between w-full max-w-[340px] mb-2 px-1">
        {/* Character Tabs if word has multiple characters */}
        {characters.length > 1 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-stone-500 font-semibold">Tập viết:</span>
            {characters.map((ch, idx) => {
              const isCurrent = selectedCharIndex === idx;
              const isDone = completedIndices.has(idx);
              return (
                <button
                  key={`${ch}-${idx}`}
                  type="button"
                  onClick={() => setSelectedCharIndex(idx)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-red-700 text-white shadow-2xs ring-1 ring-red-800'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 inline shrink-0" />
                  ) : isCurrent ? (
                    <PenTool className="w-3 h-3 text-white inline shrink-0" />
                  ) : null}
                  <span>
                    {(hideCharacterPrompt && !isHintShown)
                      ? `Chữ ${idx + 1}`
                      : ch}
                  </span>
                  <span className="text-[10px] opacity-75">
                    ({idx + 1}/{characters.length})
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-800 border border-red-200 shadow-2xs">
            <PenTool className="w-3.5 h-3.5 text-red-700" />
            <span>Tự nhớ mặt chữ & viết theo nét</span>
          </div>
        )}

        {totalStrokes > 0 && (
          <div className="flex items-center gap-1 text-xs font-bold text-stone-600">
            <span>Tiến độ:</span>
            <span className="text-red-700">
              {currentStrokeIndex} / {totalStrokes}
            </span>
            <span className="text-[10px] text-stone-400 font-normal">nét</span>
          </div>
        )}
      </div>

      {/* Revealed Hint Banner when user clicks Gợi ý chữ */}
      {isHintShown && (
        <div className="w-full max-w-[340px] mb-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
            <span className="text-[11px] font-bold text-amber-900">Gợi ý mặt chữ:</span>
            <span className="font-hanzi font-bold text-lg text-stone-900 tracking-wider">
              {targetHanzi}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsHintShown(false)}
            className="text-[10px] text-stone-500 hover:text-stone-900 px-1.5 py-0.5 rounded hover:bg-amber-200/50"
          >
            Ẩn
          </button>
        </div>
      )}

      {/* Mi-zi-ge (米字格) Canvas & HanziWriter Container */}
      <div
        style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
        className={`relative shadow-sm rounded-xl overflow-hidden border transition-all duration-200 ${
          shakeError
            ? 'border-red-500 ring-2 ring-red-400 bg-red-50/30 animate-pulse'
            : 'border-stone-200/90 bg-[#fdfbf7]'
        }`}
      >
        {/* Traditional Mi-zi-ge SVG Grid Background */}
        <svg
          className="absolute inset-0 pointer-events-none w-full h-full"
          viewBox={`0 0 ${canvasSize} ${canvasSize}`}
        >
          {/* Outer Border */}
          <rect
            x="4"
            y="4"
            width={canvasSize - 8}
            height={canvasSize - 8}
            fill="none"
            stroke="#e7a09c"
            strokeWidth="2"
          />
          {/* Inner Dashed Lines */}
          <g stroke="#f0c4c1" strokeWidth="1" strokeDasharray="5,5">
            {/* Horizontal Center */}
            <line x1="4" y1={canvasSize / 2} x2={canvasSize - 4} y2={canvasSize / 2} />
            {/* Vertical Center */}
            <line x1={canvasSize / 2} y1="4" x2={canvasSize / 2} y2={canvasSize - 4} />
            {/* Diagonals forming the 米 grid */}
            <line x1="4" y1="4" x2={canvasSize - 4} y2={canvasSize - 4} />
            <line x1={canvasSize - 4} y1="4" x2="4" y2={canvasSize - 4} />
          </g>
        </svg>

        {/* HanziWriter SVG DOM Mount Target */}
        <div
          ref={writerDomRef}
          style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
          className="relative z-10 cursor-crosshair flex items-center justify-center"
        />

        {/* Quick Action: Audio Pronunciation */}
        <button
          type="button"
          onClick={handleListenPronunciation}
          title="Nghe phát âm chuẩn bản ngữ"
          className="absolute top-2.5 right-2.5 z-20 p-2 rounded-full bg-white/90 shadow-sm border border-stone-200 text-stone-700 hover:text-red-700 hover:bg-stone-50 transition-colors"
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Completion Celebration Overlay */}
        {isCompleted && (
          <div className="absolute inset-0 z-30 bg-white/85 backdrop-blur-2xs flex flex-col items-center justify-center p-4 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="text-3xl sm:text-4xl font-hanzi font-bold text-stone-900 mb-1 tracking-wider">
              {characters.length > 1 ? targetHanzi : currentChar}
            </div>
            <div className="text-xs font-bold text-emerald-800">
              {characters.length > 1
                ? `Đã viết chính xác toàn bộ ${characters.length} chữ của từ "${targetHanzi}"!`
                : 'Viết chính xác 100% quy tắc bút thuận!'}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCharIndex(0);
                setCompletedIndices(new Set());
                setIsCompleted(false);
              }}
              className="mt-3 px-3.5 py-1.5 text-xs bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors shadow-2xs"
            >
              {characters.length > 1 ? 'Luyện viết lại từ đầu' : 'Viết lại lần nữa'}
            </button>
          </div>
        )}
      </div>

      {/* Realtime Feedback Banner */}
      {strokeFeedback && !isCompleted && (
        <div
          className={`w-full max-w-[340px] mt-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2 border transition-all animate-fade-in ${
            strokeFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : strokeFeedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900 font-semibold'
              : strokeFeedback.type === 'complete'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          {strokeFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : strokeFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="flex-1 leading-snug font-medium">
            {strokeFeedback.message}
          </span>
        </div>
      )}

      {/* Tool Buttons Bar */}
      <div className="flex items-center justify-between w-full max-w-[340px] mt-3 px-1 gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {/* Show Stroke Order Demonstration (Hiển thị cách viết từng nét một) */}
          <button
            type="button"
            onClick={handleToggleDemonstration}
            title="Xem hoạt ảnh viết toàn bộ chữ từng nét một theo đúng chuẩn bút thuận"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isDemonstrating
                ? 'bg-red-700 text-white border-red-800 shadow-sm animate-pulse'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200/90 shadow-2xs'
            }`}
          >
            {isDemonstrating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Dừng viết</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-800 fill-amber-700" />
                <span>Hiển thị cách viết</span>
              </>
            )}
          </button>

          {/* Toggle Outline Guide */}
          <button
            type="button"
            onClick={handleToggleGhost}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              showGhost
                ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-2xs'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
          >
            {showGhost ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showGhost ? 'Ẩn nét mờ' : 'Hiện nét mờ'}</span>
          </button>

          {/* Toggle Hint for character */}
          <button
            type="button"
            onClick={() => setIsHintShown(!isHintShown)}
            title="Xem gợi ý mặt chữ Hán nếu bạn quên"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isHintShown
                ? 'bg-amber-200/90 text-amber-950 border-amber-400 shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300/80 shadow-2xs'
            }`}
          >
            <Lightbulb className={`w-3.5 h-3.5 ${isHintShown ? 'fill-amber-600 text-amber-800' : 'text-amber-700'}`} />
            <span>{isHintShown ? 'Ẩn gợi ý' : 'Gợi ý chữ'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleReset}
          title="Xóa ô và luyện viết lại từ đầu"
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg border border-red-200/60 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Viết lại</span>
        </button>
      </div>

      <div className="text-[11px] text-stone-400 mt-2 flex items-center gap-1 text-center">
        <HelpCircle className="w-3 h-3 text-stone-400 shrink-0" />
        <span>
          Viết trực tiếp lên ô Mễ tự theo đúng thứ tự nét bút. Nét đúng sẽ tự động hiện mực thư pháp!
        </span>
      </div>
    </div>
  );
};
