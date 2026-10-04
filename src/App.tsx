/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase/config';
import { Card, Deck, UserProfile, OcrExtractedWord } from './types';
import { storageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { StudySession } from './components/StudySession';
import { DeckManager } from './components/DeckManager';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { OcrModal } from './components/OcrModal';
import { SettingsModal } from './components/SettingsModal';
import { DonationModal } from './components/DonationModal';
import { AuthModal } from './components/AuthModal';
import { UserGuideModal } from './components/UserGuideModal';
import { FeedbackModal } from './components/FeedbackModal';
import { WeakCardsModal } from './components/WeakCardsModal';
import { Heart, Coffee, Ban, LogOut } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'study' | 'decks' | 'dashboard' | 'admin'>('study');
  const [decks, setDecks] = useState<Deck[]>(() => storageService.getDecks());
  const [cards, setCards] = useState<Card[]>(() => storageService.getCards());
  const [currentDeckId, setCurrentDeckId] = useState<string>('all');
  const [profile, setProfile] = useState<UserProfile>(() => storageService.getProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Blacklist state
  const [bannedStatus, setBannedStatus] = useState<{ isBanned: boolean; reason?: string }>({
    isBanned: false,
  });

  // Auth Error & Loading State
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Modals
  const [isOcrOpen, setIsOcrOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDonationOpen, setIsDonationOpen] = useState<boolean>(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [isWeakCardsModalOpen, setIsWeakCardsModalOpen] = useState<boolean>(false);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firebase Auth listener & Cloud Sync
  useEffect(() => {
    // 1. Fetch latest system vocabulary: Priority 1 from Cloud Firestore (Admin Cloud DB), fallback to server API
    const syncSystemVocab = async () => {
      try {
        const cloudVocab = await storageService.fetchSystemVocabFromCloud();
        if (cloudVocab && cloudVocab.deck && Array.isArray(cloudVocab.cards) && cloudVocab.cards.length > 0) {
          const localDecks = storageService.getDecks();
          const localCards = storageService.getCards();
          const userCustomDecks = localDecks.filter(
            (d: Deck) => !d.isSystem && d.userId !== 'system' && d.id !== 'deck-daily-conversations' && d.id !== 'deck-hsk1-core'
          );
          const mergedDecks = [cloudVocab.deck, ...userCustomDecks];
          storageService.saveDecks(mergedDecks);
          setDecks(mergedDecks);

          const systemCardIds = new Set(cloudVocab.cards.map((c: Card) => c.id));
          const userCustomCards = localCards.filter(
            (c: Card) =>
              !systemCardIds.has(c.id) &&
              c.userId !== 'system' &&
              c.deckId !== 'deck-daily-conversations' &&
              c.deckId !== 'deck-hsk1-core'
          );
          const mergedCards = [...cloudVocab.cards, ...userCustomCards];
          storageService.saveCards(mergedCards);
          setCards(mergedCards);
          return;
        }
      } catch (err) {
        console.warn('Notice loading from Cloud Firestore:', err);
      }

      // Fallback: server API
      try {
        const res = await fetch('/api/system-vocab');
        const data = await res.json();
        if (data.success && Array.isArray(data.decks) && data.decks.length > 0) {
          const localDecks = storageService.getDecks();
          const localCards = storageService.getCards();

          const userCustomDecks = localDecks.filter(
            (d: Deck) => !d.isSystem && d.userId !== 'system' && d.id !== 'deck-daily-conversations' && d.id !== 'deck-hsk1-core'
          );
          const mergedDecks = [...data.decks, ...userCustomDecks];
          storageService.saveDecks(mergedDecks);
          setDecks(mergedDecks);

          if (Array.isArray(data.cards) && data.cards.length > 0) {
            const systemCardIds = new Set(data.cards.map((c: Card) => c.id));
            const userCustomCards = localCards.filter(
              (c: Card) =>
                !systemCardIds.has(c.id) &&
                c.userId !== 'system' &&
                c.deckId !== 'deck-daily-conversations' &&
                c.deckId !== 'deck-hsk1-core'
            );
            const mergedCards = [...data.cards, ...userCustomCards];
            storageService.saveCards(mergedCards);
            setCards(mergedCards);
          }
        }
      } catch {}
    };

    syncSystemVocab();

    // 2. Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check if user is in blacklist (Requirement 7)
        const banCheck = await storageService.checkIsUserBlacklisted(user.email, user.uid);
        if (banCheck.isBanned) {
          setBannedStatus(banCheck);
          return;
        } else {
          setBannedStatus({ isBanned: false });
        }

        // Sync with cloud on login (Requirement 1)
        await storageService.syncWithCloud(user);
        // Refresh state from storage
        setDecks(storageService.getDecks());
        setCards(storageService.getCards());
        setProfile(storageService.getProfile());
      } else {
        setBannedStatus({ isBanned: false });
      }
    });

    return () => unsubscribe();
  }, []);

  // Daily reminder scheduler
  useEffect(() => {
    const checkReminder = () => {
      const settings = storageService.getSettings();
      if (!settings.reminderEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      const lastRemindedDate = localStorage.getItem('hanzisrs_last_reminded_date');
      const todayStr = now.toISOString().split('T')[0];

      if (currentTimeStr === settings.reminderTime && lastRemindedDate !== todayStr) {
        localStorage.setItem('hanzisrs_last_reminded_date', todayStr);
        const stats = storageService.getDashboardStats();
        new Notification('HanziSRS - Đến giờ ôn tập tiếng Trung!', {
          body: `Hôm nay bạn có ${stats.dueToday} từ cần ôn tập. Duy trì chuỗi ${stats.streak} ngày nhé!`,
          icon: '/favicon.ico',
        });
      }
    };

    const interval = setInterval(checkReminder, 45000); // Check every 45s
    return () => clearInterval(interval);
  }, []);

  // Google Login Handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Login successful: close modal & clear errors
      setIsAuthModalOpen(false);
      setAuthError(null);
    } catch (err: any) {
      console.warn('Google sign-in notice:', err);
      // Only display modal if user didn't intentionally close the popup
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError({
          code: err.code || 'auth/unknown',
          message: err.message || 'Đã xảy ra lỗi khi đăng nhập với tài khoản Google.',
        });
        setIsAuthModalOpen(true);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
    } catch (err) {
      console.warn('Signout notice:', err);
    }
  };

  // Record review in SRS
  const handleRecordReview = useCallback(
    async (card: Card, rating: 1 | 2 | 3 | 4, mode: string) => {
      await storageService.recordReview(card, rating, mode, currentUser?.uid);
      setCards(storageService.getCards());
      setProfile(storageService.getProfile());
    },
    [currentUser]
  );

  // Deck CRUD Handlers
  const handleSaveDeck = async (deck: Deck) => {
    await storageService.createOrUpdateDeck(deck, currentUser?.uid);
    setDecks(storageService.getDecks());
    setCurrentDeckId(deck.id);
  };

  const handleDeleteDeck = async (deckId: string) => {
    await storageService.deleteDeck(deckId, currentUser?.uid);
    setDecks(storageService.getDecks());
    setCards(storageService.getCards());
    if (currentDeckId === deckId) {
      setCurrentDeckId('all');
    }
  };

  // Card CRUD Handlers
  const handleSaveCard = async (card: Card) => {
    await storageService.saveCard(card, currentUser?.uid);
    setCards(storageService.getCards());
    setDecks(storageService.getDecks());
  };

  const handleDeleteCard = async (cardId: string) => {
    await storageService.deleteCard(cardId, currentUser?.uid);
    setCards(storageService.getCards());
    setDecks(storageService.getDecks());
  };

  // Bulk add cards (from Anki or OCR)
  const handleBulkAddCards = async (
    newItems: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[],
    targetDeckId: string
  ) => {
    for (const item of newItems) {
      const card: Card = {
        ...item,
        id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deckId: targetDeckId,
        userId: currentUser?.uid || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storageService.saveCard(card, currentUser?.uid);
    }
    setCards(storageService.getCards());
    setDecks(storageService.getDecks());
    setCurrentDeckId(targetDeckId);
  };

  // OCR words import
  const handleImportOcrWords = async (words: OcrExtractedWord[], targetDeckId: string) => {
    const cardItems: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = words.map(
      (w) => ({
        deckId: targetDeckId,
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        meaning: w.meaning,
        exampleSentence: w.exampleSentence,
        examplePinyin: w.examplePinyin,
        exampleMeaning: w.exampleMeaning,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: new Date().toISOString(),
        status: 'new',
      })
    );
    await handleBulkAddCards(cardItems, targetDeckId);
    setActiveTab('study');
  };

  // Create deck directly from OCR or modal
  const handleCreateDeckFromOcr = async (title: string, description: string): Promise<Deck> => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      userId: currentUser?.uid || 'default',
      title,
      description,
      color: '#b91c1c',
      cardCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storageService.createOrUpdateDeck(newDeck, currentUser?.uid);
    setDecks(storageService.getDecks());
    return newDeck;
  };

  const handleRefreshSystemData = useCallback(() => {
    fetch('/api/system-vocab')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.decks)) {
          const localDecks = storageService.getDecks();
          const localCards = storageService.getCards();

          const deckMap = new Map();
          data.decks.forEach((d: Deck) => deckMap.set(d.id, d));
          localDecks.forEach((d: Deck) => {
            if (!deckMap.has(d.id)) deckMap.set(d.id, d);
          });
          const mergedDecks = Array.from(deckMap.values());
          storageService.saveDecks(mergedDecks);
          setDecks(mergedDecks);

          if (Array.isArray(data.cards)) {
            const cardMap = new Map();
            localCards.forEach((c: Card) => cardMap.set(c.id, c));
            data.cards.forEach((c: Card) => cardMap.set(c.id, c));
            const mergedCards = Array.from(cardMap.values());
            storageService.saveCards(mergedCards);
            setCards(mergedCards);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleWeakStatus = async (cardId: string, isWeak: boolean) => {
    await storageService.toggleCardWeak(cardId, isWeak, currentUser?.uid);
    setCards(storageService.getCards());
  };

  const handleStartStudyWeakCards = () => {
    setCurrentDeckId('weak_cards');
    setActiveTab('study');
  };

  const weakCardsCount = cards.filter(
    (c) => c.isWeak === true || (c.mistakeCount && c.mistakeCount > 0) || c.status === 'learning'
  ).length;

  const dueTodayCount = storageService.getDashboardStats().dueToday;

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col text-stone-800">
      {/* BANNED ACCOUNT OVERLAY (Requirement 7) */}
      {bannedStatus.isBanned && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-center shadow-2xl border border-red-200 space-y-4 animate-in fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 text-red-700 flex items-center justify-center">
              <Ban className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-stone-900">Tài Khoản Đã Bị Khóa</h2>
              <p className="text-xs text-red-700 font-semibold">{bannedStatus.reason}</p>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tài khoản của bạn tạm thời không thể sử dụng ứng dụng do vi phạm quy tắc cộng đồng hoặc bị quản trị viên đưa vào danh sách đen.
              Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng liên hệ:
              <strong className="block text-stone-900 mt-1 font-mono">phamthemy3008@gmail.com</strong>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng Xuất Tài Khoản</span>
            </button>
          </div>
        </div>
      )}

      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openOcrModal={() => setIsOcrOpen(true)}
        openSettingsModal={() => setIsSettingsOpen(true)}
        openUserGuide={() => setIsUserGuideOpen(true)}
        openFeedbackModal={() => setIsFeedbackOpen(true)}
        openWeakCardsModal={() => setIsWeakCardsModalOpen(true)}
        weakCardsCount={weakCardsCount}
        profile={profile}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isOnline={isOnline}
        dueTodayCount={dueTodayCount}
        isLoggingIn={isLoggingIn}
      />

      {/* Main Content Area */}
      <main className="flex-1 py-4">
        {activeTab === 'study' && (
          <StudySession
            cards={cards}
            decks={decks}
            currentDeckId={currentDeckId}
            setCurrentDeckId={setCurrentDeckId}
            onRecordReview={handleRecordReview}
            onNavigateToDecks={() => setActiveTab('decks')}
            onOpenGuide={() => setIsUserGuideOpen(true)}
            onToggleWeakStatus={handleToggleWeakStatus}
            openWeakCardsModal={() => setIsWeakCardsModalOpen(true)}
          />
        )}

        {activeTab === 'decks' && (
          <DeckManager
            decks={decks}
            cards={cards}
            currentDeckId={currentDeckId}
            setCurrentDeckId={setCurrentDeckId}
            onSaveDeck={handleSaveDeck}
            onDeleteDeck={handleDeleteDeck}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
            onBulkAddCards={handleBulkAddCards}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            onStartStudy={() => setActiveTab('study')}
            onOpenGuide={() => setIsUserGuideOpen(true)}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel currentUser={currentUser} onRefreshData={handleRefreshSystemData} />
        )}
      </main>

      {/* Weak Cards Modal (Sổ Tay Từ Hay Sai & Khó Nhớ) */}
      <WeakCardsModal
        isOpen={isWeakCardsModalOpen}
        onClose={() => setIsWeakCardsModalOpen(false)}
        cards={cards}
        onStartStudyWeakCards={handleStartStudyWeakCards}
        onToggleWeakStatus={handleToggleWeakStatus}
      />

      {/* OCR Modal */}
      <OcrModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        decks={decks}
        currentDeckId={currentDeckId}
        onImportWords={handleImportOcrWords}
        onCreateDeck={handleCreateDeckFromOcr}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
      />

      {/* User Guide Modal (Requirement 5) */}
      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
      />

      {/* Feedback Modal (Requirement 6) */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        currentUser={currentUser}
        onLoginRequest={handleLogin}
      />

      {/* Auth Error & Authorization Guidance Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        error={authError}
        onRetryLogin={handleLogin}
        isLoggingIn={isLoggingIn}
      />

      {/* Zen Footer with Creator note & Donation */}
      <footer className="py-5 border-t border-stone-200/70 text-xs text-stone-500 bg-[#fdfbf7]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3.5">
          {/* Proverbs & App info */}
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-hanzi font-bold text-stone-800 text-sm">
              千里之行，始于足下
            </span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">•</span>
            <span className="text-[11px] text-stone-500 font-vietnamese">
              Học Tiếng Trung — Ôn Tập Ngắt Quãng & Luyện Viết Chữ Hán
            </span>
          </div>

          {/* Author note & Donation button */}
          <div className="flex items-center gap-3 flex-wrap justify-center font-vietnamese">
            <span className="text-xs text-stone-600 flex items-center gap-1">
              <span>Tác giả:</span>
              <strong className="text-stone-900 font-bold">Phạm Thế Mỹ</strong>
            </span>

            {/* Donation / Support Button */}
            <button
              type="button"
              onClick={() => setIsDonationOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 shadow-2xs hover:scale-105 active:scale-95 transition-all group"
            >
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 group-hover:scale-110 transition-transform" />
              <span>Ủng hộ tác giả</span>
              <span className="text-[10px] bg-rose-200/80 text-rose-900 px-1.5 py-0.2 rounded-full font-bold">
                ☕ Donate
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* Donation & Support Modal */}
      <DonationModal
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
