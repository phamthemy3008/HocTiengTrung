import React, { useState, useRef, useId } from 'react';
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Check,
  Loader2,
  BookPlus,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Deck, OcrExtractedWord } from '../types';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: Deck[];
  currentDeckId: string;
  onImportWords: (words: OcrExtractedWord[], targetDeckId: string) => Promise<void>;
  onCreateDeck: (title: string, description: string) => Promise<Deck>;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  decks,
  currentDeckId,
  onImportWords,
  onCreateDeck,
}) => {
  const ocrDeckSelectId = useId();
  const [targetDeck, setTargetDeck] = useState<string>(
    currentDeckId !== 'all' ? currentDeckId : decks[0]?.id || ''
  );
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedWords, setExtractedWords] = useState<
    (OcrExtractedWord & { selected: boolean })[]
  >([]);

  // New deck inline creation state
  const [isCreatingDeck, setIsCreatingDeck] = useState<boolean>(false);
  const [newDeckTitle, setNewDeckTitle] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Start Camera
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setIsCameraActive(false);
      setErrorMessage(
        'Không thể truy cập camera. Vui lòng cho phép quyền truy cập máy ảnh hoặc tải lên ảnh từ thư viện.'
      );
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Take Snapshot from Video
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    processImageWithOcr(dataUrl);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      processImageWithOcr(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Send to Gemini OCR API
  const processImageWithOcr = async (base64Image: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setExtractedWords([]);

    try {
      const res = await fetch('/api/ocr-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi nhận diện ảnh');
      }

      if (data.words && data.words.length > 0) {
        setExtractedWords(
          data.words.map((w: OcrExtractedWord) => ({
            ...w,
            selected: true,
          }))
        );
      } else {
        setErrorMessage('Không tìm thấy từ vựng tiếng Trung nào trong ảnh. Vui lòng chụp rõ hơn.');
      }
    } catch (err: any) {
      console.error('OCR process error:', err);
      setErrorMessage(err.message || 'Không thể trích xuất từ vựng từ ảnh này.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle selection
  const toggleSelectWord = (index: number) => {
    setExtractedWords((prev) =>
      prev.map((w, i) => (i === index ? { ...w, selected: !w.selected } : w))
    );
  };

  // Select / Deselect All
  const handleSelectAll = (select: boolean) => {
    setExtractedWords((prev) => prev.map((w) => ({ ...w, selected: select })));
  };

  // Create new deck handler
  const handleCreateNewDeck = async () => {
    if (!newDeckTitle.trim()) return;
    const created = await onCreateDeck(newDeckTitle.trim(), 'Bộ từ tạo từ ảnh chụp OCR');
    setTargetDeck(created.id);
    setIsCreatingDeck(false);
    setNewDeckTitle('');
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    const selected = extractedWords.filter((w) => w.selected);
    if (selected.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất một từ để import.');
      return;
    }
    const deckId = targetDeck || decks[0]?.id;
    if (!deckId) {
      setErrorMessage('Vui lòng chọn bộ từ vựng đích.');
      return;
    }

    await onImportWords(selected, deckId);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setExtractedWords([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200/80 flex items-center justify-between bg-[#fbf9f5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Camera className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                Nhận Diện Ký Tự Quang Học (OCR)
              </h3>
              <p className="text-xs text-stone-500">
                Chụp ảnh sách giáo trình hoặc tải ảnh để trích xuất tự động danh sách từ vựng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Target Deck Selection */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={ocrDeckSelectId} className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-700" />
                <span>Thêm vào bộ từ vựng:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingDeck(!isCreatingDeck)}
                className="text-xs text-red-700 hover:underline font-medium"
              >
                {isCreatingDeck ? 'Hủy' : '+ Tạo bộ mới'}
              </button>
            </div>

            {isCreatingDeck ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Tên bộ từ mới (vd: Bài 5 HSK2...)"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <button
                  type="button"
                  onClick={handleCreateNewDeck}
                  className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-medium hover:bg-red-800"
                >
                  Tạo
                </button>
              </div>
            ) : (
              <select
                id={ocrDeckSelectId}
                value={targetDeck}
                onChange={(e) => setTargetDeck(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.cardCount} từ)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Camera View / Image Capture Area */}
          {!capturedImage && !isCameraActive && (
            <div className="border-2 border-dashed border-stone-300 rounded-2xl p-8 text-center bg-stone-50/50 hover:bg-stone-50 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-stone-800 mb-1">
                Chụp ảnh hoặc tải lên tài liệu học
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mb-5 leading-relaxed">
                Hỗ trợ ảnh chụp trang sách HSK, đề thi, flashcard viết tay hoặc danh sách từ vựng in hoa / chữ thường.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Mở Camera Chụp Ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-300 shadow-2xs transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn Ảnh Từ Máy</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Active Live Camera Stream */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-xl bg-stone-800/80 text-white text-xs font-medium backdrop-blur-xs"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                  <span>Chụp Ngay</span>
                </button>
              </div>
            </div>
          )}

          {/* Captured Image Preview + Retry */}
          {capturedImage && (
            <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-16 h-16 rounded-lg object-cover border border-stone-300"
              />
              <div className="flex-1">
                <div className="text-xs font-semibold text-stone-800">Ảnh tài liệu đã chụp</div>
                <div className="text-[11px] text-stone-500">
                  {isLoading ? 'Đang trích xuất từ vựng qua AI...' : `Đã tìm thấy ${extractedWords.length} từ vựng`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setExtractedWords([]);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200/60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Chụp lại</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-700 animate-spin mx-auto" />
              <p className="text-sm font-medium text-stone-700">
                Đang nhận diện Hán tự, Pinyin và dịch nghĩa tiếng Việt...
              </p>
              <p className="text-xs text-stone-400">
                Hệ thống đang trích xuất câu ví dụ và chuẩn hóa thanh điệu
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Vocabulary Table */}
          {extractedWords.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span className="font-semibold">
                  Danh sách từ vựng trích xuất ({extractedWords.filter((w) => w.selected).length}/{extractedWords.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-red-700 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-stone-500 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {extractedWords.map((word, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleSelectWord(idx)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      word.selected
                        ? 'bg-amber-50/60 border-amber-300/80 shadow-2xs'
                        : 'bg-white border-stone-200 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors ${
                        word.selected
                          ? 'bg-red-700 border-red-700 text-white'
                          : 'border-stone-300 bg-white'
                      }`}
                    >
                      {word.selected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1">
                      <div>
                        <span className="text-base font-hanzi font-bold text-stone-900 mr-2">
                          {word.hanzi}
                        </span>
                        <span className="text-red-700 font-medium">{word.pinyin}</span>
                      </div>
                      <div className="sm:col-span-2 text-stone-700 font-medium">
                        {word.meaning}
                        {word.exampleSentence && (
                          <div className="text-[11px] text-stone-500 italic mt-0.5">
                            VD: {word.exampleSentence} - {word.exampleMeaning}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-[#fbf9f5] flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-200/60 transition-colors"
          >
            Đóng
          </button>

          {extractedWords.length > 0 && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <BookPlus className="w-4 h-4" />
              <span>
                Thêm {extractedWords.filter((w) => w.selected).length} Từ Vào Bộ Thẻ
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
