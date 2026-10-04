import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  Volume2,
  Play,
  Sparkles,
  CheckCircle2,
  BookmarkCheck,
  Search,
  PenTool,
  Mic,
  RotateCw,
  Flame,
  ChevronRight,
  HelpCircle,
  Award,
} from 'lucide-react';
import { Card } from '../types';
import { speechService } from '../services/speech';

interface WeakCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  onStartStudyWeakCards: () => void;
  onToggleWeakStatus: (cardId: string, isWeak: boolean) => Promise<void>;
}

export const WeakCardsModal: React.FC<WeakCardsModalProps> = ({
  isOpen,
  onClose,
  cards,
  onStartStudyWeakCards,
  onToggleWeakStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');

  // Filter weak cards: isWeak === true OR mistakeCount > 0 OR status === 'learning'
  const weakCards = useMemo(() => {
    return cards.filter(
      (c) => c.isWeak === true || (c.mistakeCount && c.mistakeCount > 0) || c.status === 'learning'
    );
  }, [cards]);

  // Distinct tags in weak cards
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    weakCards.forEach((c) => {
      if (c.tags) {
        c.tags.forEach((t) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [weakCards]);

  // Filtered by search and tag
  const filteredWeakCards = useMemo(() => {
    return weakCards.filter((c) => {
      const matchSearch =
        !searchTerm.trim() ||
        c.hanzi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.pinyin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.meaning.toLowerCase().includes(searchTerm.toLowerCase());

      const matchTag = filterTag === 'all' || (c.tags && c.tags.includes(filterTag));

      return matchSearch && matchTag;
    });
  }, [weakCards, searchTerm, filterTag]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-red-50/80 via-amber-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-stone-900">Sổ Tay Từ Hay Sai & Khó Nhớ</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-xs">
                  {weakCards.length} từ
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Tự động gom các từ bạn phát âm sai hoặc bấm "Chưa nhớ" để ôn tập cấp tốc.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm chữ Hán, pinyin, nghĩa..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          {/* Quick Study Button */}
          {weakCards.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartStudyWeakCards();
              }}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-md shadow-red-200 transition-all hover:scale-102 active:scale-98 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ôn Luyện Cấp Tốc ({weakCards.length} từ)</span>
            </button>
          )}
        </div>

        {/* Tag Filter Pills */}
        {availableTags.length > 0 && (
          <div className="px-5 py-2.5 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-stone-400 font-semibold text-[11px] shrink-0">Lọc bài:</span>
            <button
              type="button"
              onClick={() => setFilterTag('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterTag === 'all'
                  ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Tất cả ({weakCards.length})
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(tag)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                  filterTag === tag
                    ? 'bg-red-700 text-white font-semibold shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Card List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredWeakCards.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                {weakCards.length === 0
                  ? 'Tuyệt vời! Hiện tại bạn không có từ nào trong Sổ tay từ hay sai.'
                  : 'Không tìm thấy từ phù hợp với tìm kiếm.'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {weakCards.length === 0
                  ? 'Khi bạn bấm "Chưa nhớ" hoặc phát âm sai trong các buổi ôn tập, hệ thống sẽ tự động lưu vào đây để bạn dễ dàng ôn lại.'
                  : 'Hãy thử tìm kiếm với từ khóa khác.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWeakCards.map((card) => (
                <div
                  key={card.id}
                  className="p-4 bg-white rounded-2xl border border-stone-200/90 hover:border-red-300 shadow-2xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Top Row: Hanzi + Pinyin + Audio */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-hanzi font-bold text-stone-900">{card.hanzi}</span>
                        <div>
                          <div className="text-xs font-mono font-bold text-red-700">{card.pinyin}</div>
                          <div className="text-xs font-bold text-stone-900 font-vietnamese line-clamp-1">
                            {card.meaning}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => speechService.speak(card.hanzi)}
                        className="p-2 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Example if any */}
                    {card.exampleSentence && (
                      <div className="p-2 rounded-xl bg-stone-50 text-[11px] text-stone-600 border border-stone-100">
                        <span className="font-hanzi font-semibold text-stone-900">{card.exampleSentence}</span>
                        {card.exampleMeaning && <span className="block text-stone-500 italic mt-0.5">{card.exampleMeaning}</span>}
                      </div>
                    )}
                  </div>

                  {/* Bottom Stats & Actions */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-stone-500">
                      {card.mistakeCount && card.mistakeCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          <span>⚠️ Sai {card.mistakeCount} lần</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <span>📌 Cần củng cố</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleWeakStatus(card.id, false)}
                      className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      title="Đánh dấu đã thuộc và xóa khỏi sổ tay từ khó"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã thuộc</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>
            Hiển thị <strong>{filteredWeakCards.length}</strong> / {weakCards.length} từ khó
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
