import { Card, Deck, StudyLog, UserProfile, SRSRatingResult } from '../types';
import { INITIAL_DECKS, INITIAL_CARDS } from '../data/defaultDecks';
import { calculateSM2, isCardDue } from './srs';
import { db, auth } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';

const STORAGE_KEYS = {
  DECKS: 'hanzisrs_decks_v1',
  CARDS: 'hanzisrs_cards_v1',
  LOGS: 'hanzisrs_logs_v1',
  PROFILE: 'hanzisrs_profile_v1',
  SETTINGS: 'hanzisrs_settings_v1',
};

export interface AppSettings {
  dailyGoal: number; // e.g. 20
  reminderTime: string; // "20:00"
  reminderEnabled: boolean;
  soundEnabled: boolean;
  showGhostOutline: boolean;
  defaultStudyMode: 'vietnamese_to_writing' | 'hanzi_to_meaning' | 'random';
}

const DEFAULT_SETTINGS: AppSettings = {
  dailyGoal: 20,
  reminderTime: '20:00',
  reminderEnabled: false,
  soundEnabled: true,
  showGhostOutline: true,
  defaultStudyMode: 'random',
};

class StorageService {
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // ===== DECKS =====
  getDecks(): Deck[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DECKS);
      if (!data) {
        this.saveDecks(INITIAL_DECKS);
        return INITIAL_DECKS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_DECKS;
    }
  }

  saveDecks(decks: Deck[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
    } catch (e) {
      console.warn('LocalStorage error saving decks:', e);
    }
  }

  async createOrUpdateDeck(deck: Deck, userId?: string): Promise<Deck> {
    const decks = this.getDecks();
    const index = decks.findIndex((d) => d.id === deck.id);
    const updated = { ...deck, updatedAt: new Date().toISOString() };
    if (index >= 0) {
      decks[index] = updated;
    } else {
      decks.unshift(updated);
    }
    this.saveDecks(decks);

    // Sync to Firestore if authenticated
    const uid = userId || auth.currentUser?.uid;
    if (uid && this.isOnline()) {
      try {
        await setDoc(doc(db, 'decks', updated.id), {
          ...updated,
          userId: uid,
        });
      } catch (err) {
        console.warn('Sync deck to Firestore notice:', err);
      }
    }
    return updated;
  }

  async deleteDeck(deckId: string, userId?: string): Promise<void> {
    const decks = this.getDecks().filter((d) => d.id !== deckId);
    this.saveDecks(decks);

    // Also remove cards belonging to deck
    const cards = this.getCards().filter((c) => c.deckId !== deckId);
    this.saveCards(cards);

    const uid = userId || auth.currentUser?.uid;
    if (uid && this.isOnline()) {
      try {
        await deleteDoc(doc(db, 'decks', deckId));
      } catch (err) {
        console.warn('Delete deck from Firestore notice:', err);
      }
    }
  }

  // ===== CARDS =====
  getCards(): Card[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CARDS);
      if (!data) {
        this.saveCards(INITIAL_CARDS);
        return INITIAL_CARDS;
      }
      const parsed: Card[] = JSON.parse(data);
      let hasChanges = false;
      const initialMap = new Map(INITIAL_CARDS.map((c) => [c.id, c]));
      const cleaned = parsed.map((c) => {
        let updated = c;
        if (c.meaning === 'uống (trà, nước, cà phê)' || c.meaning?.includes('(trà, nước, cà phê)')) {
          updated = { ...updated, meaning: 'uống' };
          hasChanges = true;
        }
        if ((!updated.tags || updated.tags.length === 0) && initialMap.has(c.id)) {
          const defaultC = initialMap.get(c.id);
          if (defaultC?.tags) {
            updated = { ...updated, tags: defaultC.tags };
            hasChanges = true;
          }
        }
        return updated;
      });
      if (hasChanges) {
        this.saveCards(cleaned);
      }
      return cleaned;
    } catch {
      return INITIAL_CARDS;
    }
  }

  saveCards(cards: Card[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    } catch (e) {
      console.warn('LocalStorage error saving cards:', e);
    }
  }

  getCardsByDeck(deckId: string): Card[] {
    return this.getCards().filter((c) => c.deckId === deckId);
  }

  async saveCard(card: Card, userId?: string): Promise<Card> {
    const cards = this.getCards();
    const index = cards.findIndex((c) => c.id === card.id);
    const updated: Card = {
      ...card,
      updatedAt: new Date().toISOString(),
    };
    if (index >= 0) {
      cards[index] = updated;
    } else {
      cards.unshift(updated);
    }
    this.saveCards(cards);

    // Update deck cardCount
    this.recalculateDeckCounts();

    const uid = userId || auth.currentUser?.uid;
    if (uid && this.isOnline()) {
      try {
        await setDoc(doc(db, 'cards', updated.id), {
          ...updated,
          userId: uid,
        });
      } catch (err) {
        console.warn('Sync card to Firestore notice:', err);
      }
    }
    return updated;
  }

  async deleteCard(cardId: string, userId?: string): Promise<void> {
    const cards = this.getCards().filter((c) => c.id !== cardId);
    this.saveCards(cards);
    this.recalculateDeckCounts();

    const uid = userId || auth.currentUser?.uid;
    if (uid && this.isOnline()) {
      try {
        await deleteDoc(doc(db, 'cards', cardId));
      } catch (err) {
        console.warn('Delete card from Firestore notice:', err);
      }
    }
  }

  private recalculateDeckCounts(): void {
    const decks = this.getDecks();
    const cards = this.getCards();
    const updated = decks.map((deck) => ({
      ...deck,
      cardCount: cards.filter((c) => c.deckId === deck.id).length,
    }));
    this.saveDecks(updated);
  }

  // ===== SRS REVIEW =====
  async recordReview(
    card: Card,
    rating: 1 | 2 | 3 | 4,
    mode: string,
    userId?: string
  ): Promise<{ updatedCard: Card; log: StudyLog }> {
    const srsResult: SRSRatingResult = calculateSM2(card, rating);
    const updatedCard: Card = {
      ...card,
      ...srsResult,
      lastReviewed: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveCard(updatedCard, userId);

    // Create study log
    const todayStr = new Date().toISOString().split('T')[0];
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const log: StudyLog = {
      id: logId,
      userId: userId || auth.currentUser?.uid || 'anonymous',
      cardId: card.id,
      deckId: card.deckId,
      rating,
      mode,
      date: todayStr,
      createdAt: new Date().toISOString(),
    };

    const logs = this.getLogs();
    logs.push(log);
    this.saveLogs(logs);

    // Update user streak & today's study count
    this.updateStreak();

    // Sync log to Firestore
    const uid = userId || auth.currentUser?.uid;
    if (uid && this.isOnline()) {
      try {
        await setDoc(doc(db, 'study_logs', log.id), log);
      } catch (err) {
        console.warn('Sync log notice:', err);
      }
    }

    return { updatedCard, log };
  }

  getLogs(): StudyLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveLogs(logs: StudyLog[]): void {
    try {
      // Keep last 1500 logs to prevent storage overflow
      const trimmed = logs.slice(-1500);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Error saving logs:', e);
    }
  }

  // ===== STATS & STREAK =====
  updateStreak(): { streak: number; todayCount: number } {
    const profile = this.getProfile();
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const todayLogs = this.getLogs().filter((l) => l.date === today);
    const todayCount = todayLogs.length;

    let streak = profile.streak || 0;
    if (profile.lastStudyDate === today) {
      // Already studied today, keep current streak
    } else if (profile.lastStudyDate === yesterday) {
      // Studied yesterday, increment streak today!
      streak += 1;
    } else {
      // Broken streak or first day
      streak = 1;
    }

    const updatedProfile: UserProfile = {
      ...profile,
      streak,
      lastStudyDate: today,
      totalCardsLearned: this.getCards().filter((c) => c.status !== 'new').length,
      updatedAt: new Date().toISOString(),
    };
    this.saveProfile(updatedProfile);

    return { streak, todayCount };
  }

  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) return JSON.parse(data);
    } catch {}

    const defaultProfile: UserProfile = {
      uid: 'anonymous',
      displayName: 'Học viên Hán ngữ',
      email: '',
      dailyGoal: 20,
      streak: 1,
      lastStudyDate: new Date().toISOString().split('T')[0],
      totalCardsLearned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {}

    const uid = auth.currentUser?.uid;
    if (uid && this.isOnline() && profile.email) {
      try {
        setDoc(doc(db, 'users', uid), {
          ...profile,
          uid,
        }).catch(() => {});
      } catch {}
    }
  }

  // ===== SETTINGS =====
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {}
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }

  // ===== CLOUD SYNC ON LOGIN =====
  async syncWithCloud(user: any): Promise<void> {
    if (!user || !this.isOnline()) return;

    try {
      // 1. Fetch user's remote decks
      const decksQuery = query(
        collection(db, 'decks'),
        where('userId', '==', user.uid)
      );
      const decksSnap = await getDocs(decksQuery);
      const remoteDecks: Deck[] = [];
      decksSnap.forEach((docSnap) => remoteDecks.push(docSnap.data() as Deck));

      // 2. Fetch user's remote cards
      const cardsQuery = query(
        collection(db, 'cards'),
        where('userId', '==', user.uid)
      );
      const cardsSnap = await getDocs(cardsQuery);
      const remoteCards: Card[] = [];
      cardsSnap.forEach((docSnap) => remoteCards.push(docSnap.data() as Card));

      const localDecks = this.getDecks();
      const localCards = this.getCards();

      // If remote has data, merge remote into local
      if (remoteDecks.length > 0 || remoteCards.length > 0) {
        const mergedDecksMap = new Map<string, Deck>();
        localDecks.forEach((d) => mergedDecksMap.set(d.id, d));
        remoteDecks.forEach((d) => mergedDecksMap.set(d.id, d));
        this.saveDecks(Array.from(mergedDecksMap.values()));

        const mergedCardsMap = new Map<string, Card>();
        localCards.forEach((c) => mergedCardsMap.set(c.id, c));
        remoteCards.forEach((c) => mergedCardsMap.set(c.id, c));
        this.saveCards(Array.from(mergedCardsMap.values()));
      } else {
        // Upload initial local data to remote for new cloud user
        for (const deck of localDecks) {
          await setDoc(doc(db, 'decks', deck.id), {
            ...deck,
            userId: user.uid,
          });
        }
        for (const card of localCards) {
          await setDoc(doc(db, 'cards', card.id), {
            ...card,
            userId: user.uid,
          });
        }
      }

      // Update profile
      const currentProfile = this.getProfile();
      const updatedProfile: UserProfile = {
        ...currentProfile,
        uid: user.uid,
        displayName: user.displayName || currentProfile.displayName,
        email: user.email || currentProfile.email,
        photoURL: user.photoURL || undefined,
        updatedAt: new Date().toISOString(),
      };
      this.saveProfile(updatedProfile);
    } catch (err) {
      console.warn('Sync on login notice:', err);
    }
  }

  // ===== STATS CALCULATION =====
  getDashboardStats() {
    const cards = this.getCards();
    const logs = this.getLogs();
    const profile = this.getProfile();
    const today = new Date().toISOString().split('T')[0];

    const dueToday = cards.filter((c) => isCardDue(c)).length;
    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const reviewCount = cards.filter((c) => c.status === 'review').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;

    const todayReviews = logs.filter((l) => l.date === today);
    const goodOrEasyToday = todayReviews.filter((l) => l.rating >= 3).length;
    const retentionRate =
      todayReviews.length > 0
        ? Math.round((goodOrEasyToday / todayReviews.length) * 100)
        : 95;

    // Past 7 days review history
    const past7Days: { date: string; count: number; dayName: string }[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const count = logs.filter((l) => l.date === dateStr).length;
      past7Days.push({
        date: dateStr,
        count,
        dayName: dayNames[d.getDay()],
      });
    }

    return {
      totalCards: cards.length,
      dueToday,
      newCount,
      learningCount,
      reviewCount,
      masteredCount,
      streak: profile.streak || 1,
      todayReviewsCount: todayReviews.length,
      dailyGoal: profile.dailyGoal || 20,
      retentionRate,
      past7Days,
    };
  }
}

export const storageService = new StorageService();
