import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Search,
  Download,
  Save,
  RotateCcw,
  Tag,
  Layers,
  Check,
  AlertCircle,
  Upload,
  BookOpen,
  Volume2,
  X,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { Card, Deck } from '../types';
import { parseAnkiOrText } from '../services/ankiImporter';
import { speechService } from '../services/speech';

export const ADMIN_EMAIL = 'phamthemy3008@gmail.com';

interface AdminPanelProps {
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onRefreshData }) => {
  // Authorization Gate
  const isAdmin = currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Data states
  const [systemDecks, setSystemDecks] = useState<Deck[]>([]);
  const [systemCards, setSystemCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selection & Filters
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  // Deck Modal
  const [isDeckModalOpen, setIsDeckModalOpen] = useState<boolean>(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckTitle, setDeckTitle] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [deckColor, setDeckColor] = useState<string>('#b91c1c');

  // Card Modal
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardDeckId, setCardDeckId] = useState<string>('');
  const [cardHanzi, setCardHanzi] = useState<string>('');
  const [cardPinyin, setCardPinyin] = useState<string>('');
  const [cardMeaning, setCardMeaning] = useState<string>('');
  const [cardExample, setCardExample] = useState<string>('');
  const [cardExamplePinyin, setCardExamplePinyin] = useState<string>('');
  const [cardExampleMeaning, setCardExampleMeaning] = useState<string>('');
  const [cardTags, setCardTags] = useState<string[]>([]);
  const [cardTagInput, setCardTagInput] = useState<string>('');

  // Anki / File Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importContent, setImportContent] = useState<string>('');
  const [importTargetDeckId, setImportTargetDeckId] = useState<string>('');
  const [importTagsInput, setImportTagsInput] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreviewCount, setImportPreviewCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tag Manager Modal
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [tagToRename, setTagToRename] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState<string>('');

  // Fetch current system vocabulary from server
  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/system-vocab');
      const data = await res.json();
      if (data.success) {
        setSystemDecks(data.decks || []);
        setSystemCards(data.cards || []);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu hệ thống:', err);
      setStatusMessage({ type: 'error', text: 'Không thể kết nối máy chủ để tải bộ từ hệ thống.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSystemData();
    }
  }, [isAdmin]);

  // Save changes to backend server
  const handleSaveToServer = async (newDecks = systemDecks, newCards = systemCards) => {
    if (!currentUser?.email) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/system-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': currentUser.email,
        },
        body: JSON.stringify({ decks: newDecks, cards: newCards }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Đã lưu thành công ${data.totalDecks} bộ từ & ${data.totalCards} từ vựng hệ thống vào máy chủ!`,
        });
        onRefreshData?.();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Lỗi khi lưu dữ liệu hệ thống.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn khôi phục bộ từ hệ thống về mặc định ban đầu? Tất cả thay đổi chỉnh sửa hệ thống sẽ bị xóa.')) {
      return;
    }
    if (!currentUser?.email) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/system-vocab/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': currentUser.email,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSystemDecks(data.decks || []);
        setSystemCards(data.cards || []);
        setStatusMessage({ type: 'success', text: 'Đã khôi phục bộ từ hệ thống về mặc định gốc.' });
        onRefreshData?.();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi khi khôi phục.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON backup
  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      admin: currentUser?.email,
      totalDecks: systemDecks.length,
      totalCards: systemCards.length,
      decks: systemDecks,
      cards: systemCards,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `he-thong-tu-vung-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate tag statistics
  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    systemCards.forEach((c) => {
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
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [systemCards]);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return systemCards.filter((card) => {
      const matchDeck = selectedDeckId === 'all' || card.deckId === selectedDeckId;
      const matchTag = selectedTagFilter === 'all' || (card.tags && card.tags.includes(selectedTagFilter));
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        card.hanzi.toLowerCase().includes(q) ||
        (card.pinyin && card.pinyin.toLowerCase().includes(q)) ||
        card.meaning.toLowerCase().includes(q) ||
        (card.tags && card.tags.some((t) => t.toLowerCase().includes(q)));
      return matchDeck && matchTag && matchSearch;
    });
  }, [systemCards, selectedDeckId, selectedTagFilter, searchQuery]);

  // Tag Management Actions
  const handleRenameTag = (oldTag: string, newTag: string) => {
    const cleanNew = newTag.trim();
    if (!cleanNew || cleanNew === oldTag) return;
    const updatedCards = systemCards.map((c) => {
      if (!c.tags || !c.tags.includes(oldTag)) return c;
      const updatedTags = c.tags.map((t) => (t === oldTag ? cleanNew : t));
      return { ...c, tags: Array.from(new Set(updatedTags)) };
    });
    setSystemCards(updatedCards);
    handleSaveToServer(systemDecks, updatedCards);
    setTagToRename(null);
    setNewTagName('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tag "#${tagToDelete}" khỏi toàn bộ ${tagStats.find((t) => t.name === tagToDelete)?.count || 0} từ trong hệ thống?`)) {
      return;
    }
    const updatedCards = systemCards.map((c) => {
      if (!c.tags || !c.tags.includes(tagToDelete)) return c;
      return { ...c, tags: c.tags.filter((t) => t !== tagToDelete) };
    });
    setSystemCards(updatedCards);
    handleSaveToServer(systemDecks, updatedCards);
  };

  // Deck Management Actions
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

  const handleSaveDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckTitle.trim()) return;

    let updatedDecks: Deck[];
    if (editingDeck) {
      updatedDecks = systemDecks.map((d) =>
        d.id === editingDeck.id
          ? {
              ...d,
              title: deckTitle.trim(),
              description: deckDescription.trim(),
              color: deckColor,
              updatedAt: new Date().toISOString(),
            }
          : d
      );
    } else {
      const newDeck: Deck = {
        id: `deck-system-${Date.now()}`,
        userId: 'system',
        title: deckTitle.trim(),
        description: deckDescription.trim(),
        color: deckColor,
        cardCount: 0,
        isSystem: true,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedDecks = [...systemDecks, newDeck];
    }

    setSystemDecks(updatedDecks);
    setIsDeckModalOpen(false);
    handleSaveToServer(updatedDecks, systemCards);
  };

  const handleDeleteDeck = (deckId: string) => {
    const deck = systemDecks.find((d) => d.id === deckId);
    if (!deck) return;
    if (
      !confirm(
        `Xóa bộ từ hệ thống "${deck.title}" và toàn bộ ${
          systemCards.filter((c) => c.deckId === deckId).length
        } từ bên trong?`
      )
    ) {
      return;
    }

    const updatedDecks = systemDecks.filter((d) => d.id !== deckId);
    const updatedCards = systemCards.filter((c) => c.deckId !== deckId);
    setSystemDecks(updatedDecks);
    setSystemCards(updatedCards);
    if (selectedDeckId === deckId) setSelectedDeckId('all');
    handleSaveToServer(updatedDecks, updatedCards);
  };

  // Card Management Actions
  const handleOpenCardModal = (card?: Card) => {
    if (card) {
      setEditingCard(card);
      setCardDeckId(card.deckId);
      setCardHanzi(card.hanzi);
      setCardPinyin(card.pinyin || '');
      setCardMeaning(card.meaning);
      setCardExample(card.exampleSentence || '');
      setCardExamplePinyin(card.examplePinyin || '');
      setCardExampleMeaning(card.exampleMeaning || '');
      setCardTags(card.tags ? [...card.tags] : []);
    } else {
      setEditingCard(null);
      setCardDeckId(selectedDeckId !== 'all' ? selectedDeckId : systemDecks[0]?.id || '');
      setCardHanzi('');
      setCardPinyin('');
      setCardMeaning('');
      setCardExample('');
      setCardExamplePinyin('');
      setCardExampleMeaning('');
      setCardTags([]);
    }
    setCardTagInput('');
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHanzi.trim() || !cardMeaning.trim() || !cardDeckId) return;

    let updatedCards: Card[];
    if (editingCard) {
      updatedCards = systemCards.map((c) =>
        c.id === editingCard.id
          ? {
              ...c,
              deckId: cardDeckId,
              hanzi: cardHanzi.trim(),
              pinyin: cardPinyin.trim(),
              meaning: cardMeaning.trim(),
              exampleSentence: cardExample.trim() || undefined,
              examplePinyin: cardExamplePinyin.trim() || undefined,
              exampleMeaning: cardExampleMeaning.trim() || undefined,
              tags: cardTags.length > 0 ? cardTags : undefined,
              updatedAt: new Date().toISOString(),
            }
          : c
      );
    } else {
      const newCard: Card = {
        id: `card-system-${Date.now()}`,
        deckId: cardDeckId,
        userId: 'system',
        hanzi: cardHanzi.trim(),
        pinyin: cardPinyin.trim(),
        meaning: cardMeaning.trim(),
        exampleSentence: cardExample.trim() || undefined,
        examplePinyin: cardExamplePinyin.trim() || undefined,
        exampleMeaning: cardExampleMeaning.trim() || undefined,
        tags: cardTags.length > 0 ? cardTags : undefined,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: new Date().toISOString(),
        status: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedCards = [newCard, ...systemCards];
    }

    // Recalculate deck counts
    const updatedDecks = systemDecks.map((d) => ({
      ...d,
      cardCount: updatedCards.filter((c) => c.deckId === d.id).length,
    }));

    setSystemDecks(updatedDecks);
    setSystemCards(updatedCards);
    setIsCardModalOpen(false);
    handleSaveToServer(updatedDecks, updatedCards);
  };

  const handleDeleteCard = (cardId: string) => {
    const card = systemCards.find((c) => c.id === cardId);
    if (!card) return;
    if (!confirm(`Xóa từ "${card.hanzi}" (${card.meaning}) khỏi bộ từ hệ thống?`)) return;

    const updatedCards = systemCards.filter((c) => c.id !== cardId);
    const updatedDecks = systemDecks.map((d) => ({
      ...d,
      cardCount: updatedCards.filter((c) => c.deckId === d.id).length,
    }));

    setSystemDecks(updatedDecks);
    setSystemCards(updatedCards);
    handleSaveToServer(updatedDecks, updatedCards);
  };

  // File & Anki Import Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setImportContent(text);
        const parsed = parseAnkiOrText(text, importTargetDeckId || systemDecks[0]?.id || '');
        setImportPreviewCount(parsed.cards.length);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    setImportError(null);
    const targetDeck = importTargetDeckId || (selectedDeckId !== 'all' ? selectedDeckId : systemDecks[0]?.id);
    if (!targetDeck) {
      setImportError('Vui lòng chọn bộ từ hệ thống đích.');
      return;
    }

    const result = parseAnkiOrText(importContent, targetDeck);
    if (!result.success || result.cards.length === 0) {
      setImportError(result.error || 'Không tìm thấy dữ liệu từ vựng hợp lệ.');
      return;
    }

    // Parse extra tags from input
    const extraTags = importTagsInput
      .split(/[,;\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    const newCards: Card[] = result.cards.map((c, idx) => ({
      ...c,
      id: `card-system-${Date.now()}-${idx}`,
      userId: 'system',
      deckId: targetDeck,
      tags: extraTags.length > 0 ? extraTags : c.tags,
      interval: 0,
      repetitions: 0,
      easeFactor: 2.5,
      dueDate: new Date().toISOString(),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const combinedCards = [...newCards, ...systemCards];
    const updatedDecks = systemDecks.map((d) => ({
      ...d,
      cardCount: combinedCards.filter((c) => c.deckId === d.id).length,
    }));

    setSystemDecks(updatedDecks);
    setSystemCards(combinedCards);
    setIsImportModalOpen(false);
    setImportContent('');
    setImportTagsInput('');
    setImportPreviewCount(0);
    handleSaveToServer(updatedDecks, combinedCards);
  };

  // ACCESS DENIED VIEW
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Khu Vực Quản Trị Hệ Thống (Admin Only)</h2>
        <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
          Trang quản trị bộ từ vựng hệ thống chỉ được cấp phép độc quyền cho tài khoản:
          <strong className="block text-red-700 mt-1 font-mono text-base">{ADMIN_EMAIL}</strong>
        </p>
        <p className="text-xs text-stone-400 mt-4">
          Tài khoản hiện tại: {currentUser ? currentUser.email : 'Chưa đăng nhập'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Admin Badge */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-red-700" />
              <span>Admin: {ADMIN_EMAIL}</span>
            </span>
            <span className="text-xs text-stone-400">| Quyền quản trị hệ thống cao nhất</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight mt-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-700" />
            <span>Quản Trị Bộ Từ Vựng Mặc Định Hệ Thống</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Mọi sửa đổi, thêm từ, xóa từ hay thay đổi thẻ Tag tại đây sẽ được lưu trữ vĩnh viễn trên máy chủ cho tất cả người học.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tag Manager Button */}
          <button
            type="button"
            onClick={() => setIsTagModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 transition-colors shadow-2xs"
          >
            <Tag className="w-4 h-4 text-amber-700" />
            <span>Quản Lý Tags ({tagStats.length})</span>
          </button>

          {/* Import Anki / File Button */}
          <button
            type="button"
            onClick={() => {
              setImportTargetDeckId(selectedDeckId !== 'all' ? selectedDeckId : systemDecks[0]?.id || '');
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold border border-blue-200 transition-colors shadow-2xs"
          >
            <Upload className="w-4 h-4 text-blue-700" />
            <span>Import Anki / File</span>
          </button>

          {/* Save to Server Button */}
          <button
            type="button"
            onClick={() => handleSaveToServer()}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
          </button>

          {/* Backup Button */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold border border-stone-200"
            title="Tải file JSON sao lưu hệ thống"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetToDefault}
            className="p-2 rounded-xl bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-500 text-xs font-semibold border border-stone-200"
            title="Khôi phục về bộ từ gốc ban đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs text-center">
          <span className="text-xs text-stone-500">Bộ từ hệ thống</span>
          <div className="text-xl font-bold text-stone-900 mt-0.5">{systemDecks.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs text-center">
          <span className="text-xs text-stone-500">Tổng từ vựng hệ thống</span>
          <div className="text-xl font-bold text-red-700 mt-0.5">{systemCards.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs text-center">
          <span className="text-xs text-stone-500">Tổng nhãn Tags</span>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{tagStats.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs text-center">
          <span className="text-xs text-stone-500">Bộ từ đang lọc</span>
          <div className="text-xl font-bold text-stone-800 mt-0.5">
            {selectedDeckId === 'all'
              ? 'Tất cả'
              : systemDecks.find((d) => d.id === selectedDeckId)?.title || 'Chưa chọn'}
          </div>
        </div>
      </div>

      {/* System Decks Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-red-700" />
            <span>Danh Sách Bộ Từ Hệ Thống ({systemDecks.length})</span>
          </h3>
          <button
            type="button"
            onClick={() => handleOpenDeckModal()}
            className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Bộ Từ Mới</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 'All' Selector */}
          <div
            onClick={() => setSelectedDeckId('all')}
            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
              selectedDeckId === 'all'
                ? 'bg-red-50/70 border-red-300 ring-1 ring-red-400/40 shadow-xs'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">TỔNG HỢP</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700">
                {systemCards.length} từ
              </span>
            </div>
            <h4 className="font-bold text-stone-900 text-sm">Toàn Bộ Từ Vựng Hệ Thống</h4>
            <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">Xem tất cả các từ trong mọi bộ từ</p>
          </div>

          {/* Individual System Decks */}
          {systemDecks.map((deck) => {
            const isSelected = selectedDeckId === deck.id;
            const count = systemCards.filter((c) => c.deckId === deck.id).length;
            return (
              <div
                key={deck.id}
                onClick={() => setSelectedDeckId(deck.id)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-red-50/70 border-red-300 ring-1 ring-red-400/40 shadow-xs'
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deck.color || '#b91c1c' }} />
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">
                        🌟 Hệ Thống
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenDeckModal(deck)}
                        className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                        title="Sửa tên / mô tả / màu sắc bộ từ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDeck(deck.id)}
                        className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50"
                        title="Xóa bộ từ hệ thống này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-stone-900 text-sm">{deck.title}</h4>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{deck.description || 'Chưa có mô tả'}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="font-semibold text-stone-700">{count} từ vựng</span>
                  <span className="text-red-700 font-medium">Bấm để lọc từ vựng →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards Table Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {/* Table Filters Bar */}
        <div className="p-4 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3 bg-[#fbf9f5]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm theo chữ Hán, Pinyin, nghĩa hoặc tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tag Filter Dropdown */}
            {tagStats.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-stone-500 font-medium">Lọc Tag:</span>
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-stone-800 focus:outline-none focus:ring-1 focus:ring-red-600"
                >
                  <option value="all">Tất cả tag ({tagStats.length})</option>
                  {tagStats.map((t) => (
                    <option key={t.name} value={t.name}>
                      #{t.name} ({t.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Add Card to System */}
            <button
              type="button"
              onClick={() => handleOpenCardModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Từ Vào Hệ Thống</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50/80 text-stone-500 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 w-28">Chữ Hán</th>
                <th className="py-3 px-4 w-28">Pinyin</th>
                <th className="py-3 px-4">Nghĩa Tiếng Việt & Tag</th>
                <th className="py-3 px-4 hidden md:table-cell">Bộ Từ</th>
                <th className="py-3 px-4 hidden lg:table-cell">Ví Dụ & Phiên Âm</th>
                <th className="py-3 px-4 w-20 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    Không tìm thấy từ vựng hệ thống nào.
                  </td>
                </tr>
              ) : (
                filteredCards.map((card) => {
                  const deck = systemDecks.find((d) => d.id === card.deckId);
                  return (
                    <tr key={card.id} className="hover:bg-amber-50/30 transition-colors group">
                      {/* Hanzi + Audio */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl font-hanzi font-bold text-stone-900">{card.hanzi}</span>
                          <button
                            type="button"
                            onClick={() => speechService.speak(card.hanzi)}
                            className="p-1 text-stone-400 hover:text-red-700 rounded transition-colors"
                            title="Nghe phát âm chuẩn"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Pinyin */}
                      <td className="py-3 px-4 font-medium text-stone-700 text-sm">{card.pinyin || '—'}</td>

                      {/* Meaning + Tags */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{card.meaning}</div>
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

                      {/* Deck Name */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700">
                          {deck ? deck.title : card.deckId}
                        </span>
                      </td>

                      {/* Example */}
                      <td className="py-3 px-4 text-stone-500 hidden lg:table-cell max-w-xs">
                        {card.exampleSentence ? (
                          <div>
                            <span className="font-hanzi text-stone-800 font-medium">{card.exampleSentence}</span>
                            {card.examplePinyin && (
                              <span className="text-[11px] text-stone-500 block">{card.examplePinyin}</span>
                            )}
                            {card.exampleMeaning && (
                              <span className="italic text-[11px] text-stone-400 block">{card.exampleMeaning}</span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenCardModal(card)}
                            className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 transition-colors"
                            title="Sửa từ vựng này"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                            title="Xóa từ khỏi hệ thống"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT SYSTEM DECK */}
      {isDeckModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-base">
                {editingDeck ? 'Chỉnh Sửa Bộ Từ Hệ Thống' : 'Thêm Bộ Từ Hệ Thống Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDeckModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeck} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tên bộ từ hệ thống <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HSK 1 - 150 Từ Vựng Chuẩn"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Mô tả bộ từ</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả nội dung, cấp độ hoặc hướng dẫn học cho người dùng..."
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Màu sắc nhận diện</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={deckColor}
                    onChange={(e) => setDeckColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200 p-0.5"
                  />
                  <span className="text-xs font-mono text-stone-600">{deckColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsDeckModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-xs"
                >
                  {editingDeck ? 'Cập Nhật Bộ Từ' : 'Tạo Bộ Từ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SYSTEM CARD */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-base">
                {editingCard ? 'Sửa Từ Vựng Hệ Thống' : 'Thêm Từ Vựng Vào Hệ Thống'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Thuộc bộ từ hệ thống <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={cardDeckId}
                  onChange={(e) => setCardDeckId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600 font-semibold"
                >
                  {systemDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Chữ Hán <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 学"
                    value={cardHanzi}
                    onChange={(e) => setCardHanzi(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-hanzi font-bold border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Phiên âm Pinyin</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: xué"
                    value={cardPinyin}
                    onChange={(e) => setCardPinyin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nghĩa Tiếng Việt <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: học, nghiên cứu, bắt chước"
                  value={cardMeaning}
                  onChange={(e) => setCardMeaning(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-100">
                <span className="text-xs font-bold text-stone-700 block">Câu Ví Dụ Chuẩn Mực (Tùy chọn)</span>
                <input
                  type="text"
                  placeholder="Câu tiếng Hán (Ví dụ: 我想学习汉语。)"
                  value={cardExample}
                  onChange={(e) => setCardExample(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-hanzi border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <input
                  type="text"
                  placeholder="Phiên âm Pinyin câu ví dụ (Ví dụ: Wǒ xiǎng xuéxí hànyǔ.)"
                  value={cardExamplePinyin}
                  onChange={(e) => setCardExamplePinyin(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <input
                  type="text"
                  placeholder="Dịch nghĩa câu ví dụ (Ví dụ: Tôi muốn học tiếng Hán.)"
                  value={cardExampleMeaning}
                  onChange={(e) => setCardExampleMeaning(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              {/* Tag Editor */}
              <div className="pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Gắn Tags Phân Loại (Ví dụ: HSK 1, Bài 1, Mua sắm...)
                </label>
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Nhập tên tag rồi ấn Thêm..."
                    value={cardTagInput}
                    onChange={(e) => setCardTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = cardTagInput.trim().replace(/^#/, '');
                        if (t && !cardTags.includes(t)) {
                          setCardTags([...cardTags, t]);
                          setCardTagInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = cardTagInput.trim().replace(/^#/, '');
                      if (t && !cardTags.includes(t)) {
                        setCardTags([...cardTags, t]);
                        setCardTagInput('');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg"
                  >
                    + Thêm Tag
                  </button>
                </div>

                {/* Display Current Tags */}
                {cardTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cardTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setCardTags(cardTags.filter((tag) => tag !== t))}
                          className="hover:text-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-xs"
                >
                  {editingCard ? 'Cập Nhật Từ Vựng' : 'Lưu Vào Hệ Thống'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAG MANAGER */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-stone-900 text-base">Quản Lý Toàn Bộ Tags Hệ Thống</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 mt-2">
              Bạn có thể đổi tên một tag (áp dụng tự động lên mọi từ vựng) hoặc xóa hoàn toàn tag đó khỏi hệ thống.
            </p>

            {/* Tags List */}
            <div className="mt-4 flex-1 overflow-y-auto divide-y divide-stone-100 pr-1 space-y-2">
              {tagStats.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs">Chưa có tag nào trong hệ thống.</div>
              ) : (
                tagStats.map(({ name, count }) => (
                  <div key={name} className="pt-2 flex items-center justify-between gap-3">
                    {tagToRename === name ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Nhập tên mới..."
                          className="flex-1 px-2.5 py-1 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameTag(name, newTagName)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTagToRename(null);
                            setNewTagName('');
                          }}
                          className="px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 rounded-lg"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            #{name}
                          </span>
                          <span className="text-[11px] text-stone-500">({count} từ vựng)</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTagToRename(name);
                              setNewTagName(name);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                          >
                            Đổi Tên
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(name)}
                            className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50"
                            title="Xóa tag này khỏi tất cả các từ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: IMPORT ANKI / FILE / TEXT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-stone-900 text-base">Import Anki / File Text Vào Hệ Thống</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Target Deck */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Chọn bộ từ hệ thống đích <span className="text-red-600">*</span>
                </label>
                <select
                  value={importTargetDeckId}
                  onChange={(e) => setImportTargetDeckId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600 font-semibold"
                >
                  {systemDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({systemCards.filter((c) => c.deckId === d.id).length} từ hiện có)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags to append */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Gắn nhãn Tags mặc định cho các từ này (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: HSK 1, Bài 1, Mới"
                  value={importTagsInput}
                  onChange={(e) => setImportTagsInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              {/* File upload trigger */}
              <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">Nạp từ file máy tính</span>
                  <span className="text-[11px] text-stone-500">Hỗ trợ file .txt, .tsv, .csv</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.tsv,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg text-xs font-semibold text-stone-700 shadow-2xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Chọn File...</span>
                </button>
              </div>

              {/* Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">Hoặc dán trực tiếp nội dung văn bản:</label>
                  {importPreviewCount > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Đã nhận diện: {importPreviewCount} từ hợp lệ
                    </span>
                  )}
                </div>
                <textarea
                  rows={6}
                  placeholder={`Định dạng mỗi dòng một từ:\nChữ Hán [Tab] Pinyin [Tab] Nghĩa [Tab] Câu ví dụ\nHoặc:\n你好\tnǐ hǎo\tXin chào\n学\txué\thọc`}
                  value={importContent}
                  onChange={(e) => {
                    setImportContent(e.target.value);
                    const parsed = parseAnkiOrText(e.target.value, importTargetDeckId || systemDecks[0]?.id || '');
                    setImportPreviewCount(parsed.cards.length);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              {importError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={!importContent.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs disabled:opacity-50"
                >
                  Xác Nhận Import Vào Hệ Thống
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
