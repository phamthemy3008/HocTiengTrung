import React, { useState, useMemo, useId } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  Search,
  Download,
  BookOpen,
  Volume2,
  Check,
  X,
  Layers,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Card, Deck } from '../types';
import { speechService } from '../services/speech';
import { parseAnkiOrText } from '../services/ankiImporter';
import { formatInterval } from '../services/srs';

interface DeckManagerProps {
  decks: Deck[];
  cards: Card[];
  currentDeckId: string;
  setCurrentDeckId: (id: string) => void;
  onSaveDeck: (deck: Deck) => Promise<void>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onSaveCard: (card: Card) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onBulkAddCards: (newCards: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[], deckId: string) => Promise<void>;
}

export const DeckManager: React.FC<DeckManagerProps> = ({
  decks,
  cards,
  currentDeckId,
  setCurrentDeckId,
  onSaveDeck,
  onDeleteDeck,
  onSaveCard,
  onDeleteCard,
  onBulkAddCards,
}) => {
  const ankiDeckSelectId = useId();
  // State for Deck creation/editing modal
  const [isDeckModalOpen, setIsDeckModalOpen] = useState<boolean>(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckTitle, setDeckTitle] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [deckColor, setDeckColor] = useState<string>('#b91c1c');

  // State for Card creation/editing modal
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardHanzi, setCardHanzi] = useState<string>('');
  const [cardPinyin, setCardPinyin] = useState<string>('');
  const [cardMeaning, setCardMeaning] = useState<string>('');
  const [cardExample, setCardExample] = useState<string>('');
  const [cardExampleMeaning, setCardExampleMeaning] = useState<string>('');
  const [cardTags, setCardTags] = useState<string[]>([]);
  const [cardTagInput, setCardTagInput] = useState<string>('');

  // State for Anki Import modal
  const [isAnkiModalOpen, setIsAnkiModalOpen] = useState<boolean>(false);
  const [ankiContent, setAnkiContent] = useState<string>('');
  const [ankiTargetDeckId, setAnkiTargetDeckId] = useState<string>(
    currentDeckId !== 'all' ? currentDeckId : decks[0]?.id || ''
  );
  const [ankiImportTag, setAnkiImportTag] = useState<string>('');
  const [ankiError, setAnkiError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [deckCategoryFilter, setDeckCategoryFilter] = useState<'all' | 'system' | 'custom'>('all');

  // List of all existing tags across cards
  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.tags && Array.isArray(c.tags)) {
        c.tags.forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  }, [cards]);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (!cardTags.includes(trimmed)) {
      setCardTags((prev) => [...prev, trimmed]);
    }
    setCardTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCardTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Clone a system deck into user's personal custom deck
  const handleCloneDeck = async (sourceDeck: Deck) => {
    const newDeckId = `deck-${Date.now()}`;
    const newDeck: Deck = {
      ...sourceDeck,
      id: newDeckId,
      userId: 'custom',
      title: `${sourceDeck.title} (Bản sao cá nhân)`,
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveDeck(newDeck);

    // Copy all cards from source deck into new deck
    const sourceCards = cards.filter((c) => c.deckId === sourceDeck.id);
    const copiedCards = sourceCards.map((c) => ({
      deckId: newDeckId,
      hanzi: c.hanzi,
      pinyin: c.pinyin,
      meaning: c.meaning,
      exampleSentence: c.exampleSentence,
      examplePinyin: c.examplePinyin,
      exampleMeaning: c.exampleMeaning,
      tags: c.tags ? [...c.tags] : undefined,
      interval: 0,
      repetitions: 0,
      easeFactor: 2.5,
      dueDate: new Date().toISOString(),
      status: 'new' as const,
    }));
    await onBulkAddCards(copiedCards, newDeckId);
    setCurrentDeckId(newDeckId);
  };

  // Selected deck object
  const activeDeck = useMemo(() => {
    return decks.find((d) => d.id === currentDeckId);
  }, [decks, currentDeckId]);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchDeck = currentDeckId === 'all' || card.deckId === currentDeckId;
      const matchStatus = statusFilter === 'all' || card.status === statusFilter;
      const matchTag =
        selectedTagFilter === 'all' || (card.tags && card.tags.includes(selectedTagFilter));
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        card.hanzi.toLowerCase().includes(q) ||
        (card.pinyin && card.pinyin.toLowerCase().includes(q)) ||
        card.meaning.toLowerCase().includes(q) ||
        (card.tags && card.tags.some((t) => t.toLowerCase().includes(q)));
      return matchDeck && matchStatus && matchTag && matchSearch;
    });
  }, [cards, currentDeckId, statusFilter, selectedTagFilter, searchQuery]);

  // Open Deck Modal
  const handleOpenDeckModal = (deck?: Deck) => {
    if (deck) {
      setEditingDeck(deck);
      setDeckTitle(deck.title);
      setDeckDescription(deck.description || '');
      setDeckColor(deck.color || '#b91c1c');
    } else {
      setEditingDeck(null);
      setDeckTitle('');
      setDeckDescription('');
      setDeckColor('#b91c1c');
    }
    setIsDeckModalOpen(true);
  };

  const handleSaveDeckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckTitle.trim()) return;

    const deckData: Deck = {
      id: editingDeck ? editingDeck.id : `deck-${Date.now()}`,
      userId: editingDeck ? editingDeck.userId : 'default',
      title: deckTitle.trim(),
      description: deckDescription.trim(),
      color: deckColor,
      cardCount: editingDeck ? editingDeck.cardCount : 0,
      createdAt: editingDeck ? editingDeck.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveDeck(deckData);
    setIsDeckModalOpen(false);
  };

  // Open Card Modal
  const handleOpenCardModal = (card?: Card) => {
    if (card) {
      setEditingCard(card);
      setCardHanzi(card.hanzi);
      setCardPinyin(card.pinyin || '');
      setCardMeaning(card.meaning);
      setCardExample(card.exampleSentence || '');
      setCardExampleMeaning(card.exampleMeaning || '');
      setCardTags(card.tags ? [...card.tags] : []);
    } else {
      setEditingCard(null);
      setCardHanzi('');
      setCardPinyin('');
      setCardMeaning('');
      setCardExample('');
      setCardExampleMeaning('');
      setCardTags([]);
    }
    setCardTagInput('');
    setIsCardModalOpen(true);
  };

  const handleSaveCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHanzi.trim() || !cardMeaning.trim()) return;

    const targetDeck = currentDeckId !== 'all' ? currentDeckId : decks[0]?.id;
    if (!targetDeck) return;

    const cardData: Card = {
      id: editingCard ? editingCard.id : `card-${Date.now()}`,
      deckId: editingCard ? editingCard.deckId : targetDeck,
      userId: editingCard ? editingCard.userId : 'default',
      hanzi: cardHanzi.trim(),
      pinyin: cardPinyin.trim(),
      meaning: cardMeaning.trim(),
      exampleSentence: cardExample.trim() || undefined,
      exampleMeaning: cardExampleMeaning.trim() || undefined,
      tags: cardTags.length > 0 ? cardTags : undefined,
      interval: editingCard ? editingCard.interval : 0,
      repetitions: editingCard ? editingCard.repetitions : 0,
      easeFactor: editingCard ? editingCard.easeFactor : 2.5,
      dueDate: editingCard ? editingCard.dueDate : new Date().toISOString(),
      status: editingCard ? editingCard.status : 'new',
      createdAt: editingCard ? editingCard.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveCard(cardData);
    setIsCardModalOpen(false);
  };

  // Anki Import Submit
  const handleAnkiImportSubmit = async () => {
    setAnkiError(null);
    const targetId = ankiTargetDeckId || decks[0]?.id;
    if (!targetId) {
      setAnkiError('Vui lòng chọn bộ từ đích.');
      return;
    }

    const result = parseAnkiOrText(ankiContent, targetId);
    if (!result.success || result.cards.length === 0) {
      setAnkiError(result.error || 'Lỗi phân tích cú pháp.');
      return;
    }

    const cardsWithTags = result.cards.map((c) => ({
      ...c,
      tags: ankiImportTag.trim() ? [ankiImportTag.trim()] : undefined,
    }));

    await onBulkAddCards(cardsWithTags, targetId);
    setAnkiContent('');
    setAnkiImportTag('');
    setIsAnkiModalOpen(false);
  };

  // Export Deck to CSV/JSON
  const handleExportDeck = () => {
    const dataToExport = filteredCards.map((c) => ({
      hanzi: c.hanzi,
      pinyin: c.pinyin,
      meaning: c.meaning,
      example: c.exampleSentence,
      exampleMeaning: c.exampleMeaning,
      status: c.status,
      intervalDays: c.interval,
    }));

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HocTiengTrung_${activeDeck ? activeDeck.title : 'All'}_cards.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-700" />
            <span>Quản Lý Bộ Từ Vựng Cá Nhân</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Tự do thêm mới, sắp xếp theo chủ đề hoặc import nhanh từ file Anki/CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Anki Import Button */}
          <button
            type="button"
            onClick={() => setIsAnkiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4 text-amber-700" />
            <span>Import Anki / Text</span>
          </button>

          {/* Add New Deck */}
          <button
            type="button"
            onClick={() => handleOpenDeckModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold border border-stone-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Bộ Từ Mới</span>
          </button>

          {/* Add Card to Current Deck */}
          <button
            type="button"
            onClick={() => handleOpenCardModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Từ Mới</span>
          </button>
        </div>
      </div>

      {/* Deck Category Filter Pills */}
      <div className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setDeckCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            deckCategoryFilter === 'all'
              ? 'bg-red-700 text-white shadow-2xs font-semibold'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          Tất cả bộ từ ({decks.length})
        </button>
        <button
          type="button"
          onClick={() => setDeckCategoryFilter('system')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            deckCategoryFilter === 'system'
              ? 'bg-amber-800 text-white shadow-2xs font-semibold'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          🌟 Bộ từ hệ thống ({decks.filter((d) => d.isSystem).length})
        </button>
        <button
          type="button"
          onClick={() => setDeckCategoryFilter('custom')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            deckCategoryFilter === 'custom'
              ? 'bg-stone-800 text-white shadow-2xs font-semibold'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          👤 Bộ từ riêng của tôi ({decks.filter((d) => !d.isSystem).length})
        </button>
      </div>

      {/* Decks Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 'All' Deck card */}
        {deckCategoryFilter === 'all' && (
          <div
            onClick={() => setCurrentDeckId('all')}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              currentDeckId === 'all'
                ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/40 shadow-xs'
                : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Tổng Hợp
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
                {cards.length} từ
              </span>
            </div>
            <h4 className="font-bold text-stone-900 text-base">Tất Cả Từ Vựng</h4>
            <p className="text-xs text-stone-500 mt-1 line-clamp-1">
              Toàn bộ flashcard trên tất cả các bộ từ
            </p>
          </div>
        )}

        {/* Individual Decks */}
        {decks
          .filter((deck) => {
            if (deckCategoryFilter === 'system') return deck.isSystem;
            if (deckCategoryFilter === 'custom') return !deck.isSystem;
            return true;
          })
          .map((deck) => {
            const isSelected = currentDeckId === deck.id;
            return (
              <div
                key={deck.id}
                onClick={() => setCurrentDeckId(deck.id)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/40 shadow-xs'
                    : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: deck.color || '#b91c1c' }}
                      />
                      {deck.isSystem ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200/70">
                          🌟 Mặc định hệ thống
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                          👤 Cá nhân
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {deck.isSystem ? (
                        <button
                          type="button"
                          onClick={() => handleCloneDeck(deck)}
                          className="px-2 py-0.5 text-[11px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
                          title="Tạo bản sao cá nhân để tự do chỉnh sửa"
                        >
                          + Sao chép
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenDeckModal(deck)}
                            className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                            title="Sửa bộ từ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa bộ từ "${deck.title}" và toàn bộ flashcard bên trong?`)) {
                                onDeleteDeck(deck.id);
                              }
                            }}
                            className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50"
                            title="Xóa bộ từ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h4 className="font-bold text-stone-900 text-base">{deck.title}</h4>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                    {deck.description || 'Chưa có mô tả'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                  <span>{deck.cardCount} từ vựng</span>
                  <span className="text-red-700 font-medium">Bấm để chọn học →</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Cards Table & Filters Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {/* Table Filters Bar */}
        <div className="p-4 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3 bg-[#fbf9f5]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 text-xs">
            {['all', 'new', 'learning', 'review', 'mastered'].map((st) => {
              const labels: Record<string, string> = {
                all: 'Tất cả',
                new: 'Mới',
                learning: 'Đang học',
                review: 'Ôn tập',
                mastered: 'Đã thuộc',
              };
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === st
                      ? 'bg-red-700 text-white font-medium'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>

          {/* Tag Filter Dropdown */}
          {allExistingTags.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-500 font-medium">Tag:</span>
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                <option value="all">Tất cả tag ({cards.length})</option>
                {allExistingTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export button */}
          <button
            type="button"
            onClick={handleExportDeck}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất JSON</span>
          </button>
        </div>

        {/* Cards Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50/80 text-stone-500 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 w-28">Chữ Hán</th>
                <th className="py-3 px-4 w-28">Pinyin</th>
                <th className="py-3 px-4">Nghĩa Tiếng Việt & Tag</th>
                <th className="py-3 px-4 hidden md:table-cell">Ví Dụ & Phiên Âm</th>
                <th className="py-3 px-4 w-28">Trạng Thái SRS</th>
                <th className="py-3 px-4 w-20 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    Không tìm thấy từ vựng nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredCards.map((card) => (
                  <tr key={card.id} className="hover:bg-amber-50/30 transition-colors group">
                    {/* Hanzi + Audio play */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-hanzi font-bold text-stone-900">
                          {card.hanzi}
                        </span>
                        <button
                          type="button"
                          onClick={() => speechService.speak(card.hanzi)}
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-700 transition-opacity"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Pinyin */}
                    <td className="py-3 px-4 font-medium text-red-700">
                      {card.pinyin || '—'}
                    </td>

                    {/* Meaning + Tags */}
                    <td className="py-3 px-4 font-medium text-stone-800 font-vietnamese">
                      <div>{card.meaning ? card.meaning.normalize('NFC') : ''}</div>
                      {card.tags && card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {card.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200/70"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Example */}
                    <td className="py-3 px-4 text-stone-500 hidden md:table-cell">
                      {card.exampleSentence ? (
                        <div>
                          <span className="font-hanzi text-stone-700 mr-1">
                            {card.exampleSentence}
                          </span>
                          {card.exampleMeaning && (
                            <span className="italic text-[11px] block text-stone-400">
                              {card.exampleMeaning}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* SRS Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          card.status === 'mastered'
                            ? 'bg-blue-100 text-blue-800'
                            : card.status === 'review'
                            ? 'bg-emerald-100 text-emerald-800'
                            : card.status === 'learning'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {card.status === 'mastered'
                          ? 'Đã thuộc'
                          : card.status === 'review'
                          ? `Ôn (${formatInterval(card.interval)})`
                          : card.status === 'learning'
                          ? 'Đang học'
                          : 'Từ mới'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenCardModal(card)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                          title="Sửa từ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Xóa từ "${card.hanzi}"?`)) {
                              onDeleteCard(card.id);
                            }
                          }}
                          className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50"
                          title="Xóa từ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create / Edit Deck */}
      {isDeckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-lg mb-4">
              {editingDeck ? 'Chỉnh Sửa Bộ Từ Vựng' : 'Tạo Bộ Từ Vựng Mới'}
            </h3>
            <form onSubmit={handleSaveDeckSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Tên bộ từ vựng: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HSK 2 Cốt Lõi, Từ Vựng Nhà Hàng..."
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Mô tả / Ghi chú:
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả mục tiêu học tập của bộ từ này..."
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Màu sắc đánh dấu:
                </label>
                <div className="flex items-center gap-2">
                  {['#b91c1c', '#d97706', '#047857', '#2563eb', '#7c3aed', '#db2777'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDeckColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        deckColor === c ? 'scale-125 ring-2 ring-stone-900' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDeckModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold shadow-xs"
                >
                  Lưu Bộ Từ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Card */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-lg mb-4">
              {editingCard ? 'Chỉnh Sửa Thẻ Từ Vựng' : 'Thêm Thẻ Từ Vựng Mới'}
            </h3>
            <form onSubmit={handleSaveCardSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Chữ Hán: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 学习"
                    value={cardHanzi}
                    onChange={(e) => setCardHanzi(e.target.value)}
                    className="w-full text-base font-hanzi font-bold px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Pinyin:
                  </label>
                  <input
                    type="text"
                    placeholder="xuéxí"
                    value={cardPinyin}
                    onChange={(e) => setCardPinyin(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Nghĩa Tiếng Việt: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="học tập, nghiên cứu"
                  value={cardMeaning}
                  onChange={(e) => setCardMeaning(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Câu ví dụ tiếng Trung:
                </label>
                <input
                  type="text"
                  placeholder="我喜欢学习汉语。"
                  value={cardExample}
                  onChange={(e) => setCardExample(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Dịch nghĩa câu ví dụ:
                </label>
                <input
                  type="text"
                  placeholder="Tôi thích học tiếng Hán."
                  value={cardExampleMeaning}
                  onChange={(e) => setCardExampleMeaning(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Nhãn phân nhóm bài học (Tags):
                </label>
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Nhập tag (vd: Bài 1, HSK 1) rồi nhấn Enter..."
                    value={cardTagInput}
                    onChange={(e) => setCardTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(cardTagInput);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(cardTagInput)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg text-xs"
                  >
                    + Thêm tag
                  </button>
                </div>

                {/* Selected tag chips */}
                {cardTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {cardTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-700 font-bold ml-0.5 text-xs"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick suggestions */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-stone-400">
                  <span>Gợi ý:</span>
                  {['Bài 1', 'Bài 2', 'Bài 3', 'Bài 4', 'Bài 5', 'HSK 1', 'Giao tiếp']
                    .filter((t) => !cardTags.includes(t))
                    .map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => handleAddTag(suggested)}
                        className="px-1.5 py-0.2 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200/60"
                      >
                        + {suggested}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold shadow-xs"
                >
                  Lưu Thẻ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Import from Anki / Text / CSV */}
      {isAnkiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-700" />
                <span>Nhập Dữ Liệu Từ Anki / Text / CSV</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAnkiModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Dán nội dung từ file Anki exported (TSV, TXT) hoặc danh sách từ vựng. Mỗi dòng một từ theo cú pháp:
              <br />
              <code className="text-stone-700 font-mono bg-stone-100 px-1 py-0.5 rounded text-[11px]">
                Hán tự [Tab hoặc -] Pinyin [Tab hoặc -] Nghĩa tiếng Việt
              </code>
            </p>

            <div>
              <label htmlFor={ankiDeckSelectId} className="block text-xs font-semibold text-stone-700 mb-1">
                Nhập vào bộ từ:
              </label>
              <select
                id={ankiDeckSelectId}
                value={ankiTargetDeckId}
                onChange={(e) => setAnkiTargetDeckId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Gắn nhãn tag cho toàn bộ từ import (tùy chọn):
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Bài 1, HSK 1, Từ mới tuần này..."
                value={ankiImportTag}
                onChange={(e) => setAnkiImportTag(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Dán dữ liệu vào đây:
              </label>
              <textarea
                rows={7}
                placeholder={`Ví dụ:\n你好\tnǐ hǎo\tXin chào\n谢谢\txiè xie\tCảm ơn\n再见 - zàijiàn - Tạm biệt`}
                value={ankiContent}
                onChange={(e) => setAnkiContent(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            {ankiError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs">
                {ankiError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAnkiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleAnkiImportSubmit}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold text-xs shadow-xs"
              >
                Bắt Đầu Nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
