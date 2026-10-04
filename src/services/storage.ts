import { Card, Deck, StudyLog, UserProfile, SRSRatingResult } from '../types';
import { INITIAL_DECKS, INITIAL_CARDS } from '../data/defaultDecks';
import { calculateSM2, isCardDue } from './srs';
import { db, auth } from '../firebase/config';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
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
      const parsed: Deck[] = JSON.parse(data);
      // Prune legacy system deck that was removed
      const filtered = parsed.filter((d) => d.id !== 'deck-daily-conversations');
      if (filtered.length !== parsed.length) {
        this.saveDecks(filtered);
      }
      // If no system deck left, restore INITIAL_DECKS
      const hasSystemDeck = filtered.some((d) => d.isSystem || d.id === 'deck-hsk1-core');
      if (!hasSystemDeck) {
        const merged = [...INITIAL_DECKS, ...filtered];
        this.saveDecks(merged);
        return merged;
      }
      return filtered;
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
      // Filter out cards from removed legacy deck
      let filtered = parsed.filter((c) => c.deckId !== 'deck-daily-conversations');
      
      // If user had only the previous 15 sample cards for system deck, migrate to full INITIAL_CARDS
      const systemCardsInStorage = filtered.filter((c) => c.deckId === 'deck-hsk1-core' || c.userId === 'system');
      if (systemCardsInStorage.length < 50 && INITIAL_CARDS.length > 50) {
        const userCustomCards = filtered.filter((c) => c.deckId !== 'deck-hsk1-core' && c.userId !== 'system');
        filtered = [...INITIAL_CARDS, ...userCustomCards];
        this.saveCards(filtered);
        return filtered;
      }

      // Merge fragmented tags into clean canonical tags: "Bài X" and "HSK 1"
      let tagsModified = false;
      filtered = filtered.map((c) => {
        if (!c.tags || c.tags.length === 0) return c;
        let bàiNum: number | null = null;
        const otherTags: string[] = [];

        c.tags.forEach((t) => {
          const m = t.match(/^Bài_?0?(\d+)$/i);
          if (m) {
            bàiNum = parseInt(m[1], 10);
          } else {
            otherTags.push(t.trim());
          }
        });

        const canonicalTags: string[] = [];
        if (bàiNum !== null) {
          canonicalTags.push(`Bài ${bàiNum}`);
        }
        otherTags.forEach((t) => {
          if (t && !canonicalTags.includes(t)) {
            canonicalTags.push(t);
          }
        });

        const originalTags = c.tags || [];
        if (
          canonicalTags.length !== originalTags.length ||
          canonicalTags.some((t, i) => t !== originalTags[i])
        ) {
          tagsModified = true;
          return { ...c, tags: canonicalTags };
        }
        return c;
      });

      if (filtered.length !== parsed.length || tagsModified) {
        this.saveCards(filtered);
      }
      return filtered;
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
      // 1. Fetch user's profile from Firestore
      try {
        const userDocSnap = await getDoc(doc(db, 'users', user.uid));
        if (userDocSnap.exists()) {
          const remoteProfile = userDocSnap.data() as UserProfile;
          const currentProfile = this.getProfile();
          const mergedProfile: UserProfile = {
            ...currentProfile,
            ...remoteProfile,
            uid: user.uid,
            displayName: user.displayName || remoteProfile.displayName || currentProfile.displayName,
            email: user.email || remoteProfile.email || currentProfile.email,
            photoURL: user.photoURL || remoteProfile.photoURL,
            updatedAt: new Date().toISOString(),
          };
          this.saveProfile(mergedProfile);
        } else {
          // Create initial user document
          const currentProfile = this.getProfile();
          const newProfile: UserProfile = {
            ...currentProfile,
            uid: user.uid,
            displayName: user.displayName || currentProfile.displayName,
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            updatedAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
        }
      } catch (profileErr) {
        console.warn('Profile sync notice:', profileErr);
      }

      // 2. Fetch user's remote decks
      const decksQuery = query(
        collection(db, 'decks'),
        where('userId', '==', user.uid)
      );
      const decksSnap = await getDocs(decksQuery);
      const remoteDecks: Deck[] = [];
      decksSnap.forEach((docSnap) => remoteDecks.push(docSnap.data() as Deck));

      // 3. Fetch user's remote cards & progress
      const cardsQuery = query(
        collection(db, 'cards'),
        where('userId', '==', user.uid)
      );
      const cardsSnap = await getDocs(cardsQuery);
      const remoteCards: Card[] = [];
      cardsSnap.forEach((docSnap) => remoteCards.push(docSnap.data() as Card));

      // 4. Fetch user's study logs
      try {
        const logsQuery = query(
          collection(db, 'study_logs'),
          where('userId', '==', user.uid)
        );
        const logsSnap = await getDocs(logsQuery);
        const remoteLogs: StudyLog[] = [];
        logsSnap.forEach((docSnap) => remoteLogs.push(docSnap.data() as StudyLog));

        if (remoteLogs.length > 0) {
          const localLogs = this.getLogs();
          const logsMap = new Map<string, StudyLog>();
          localLogs.forEach((l) => logsMap.set(l.id, l));
          remoteLogs.forEach((l) => logsMap.set(l.id, l));
          this.saveLogs(Array.from(logsMap.values()));
        }
      } catch (logsErr) {
        console.warn('Logs sync notice:', logsErr);
      }

      const localDecks = this.getDecks();
      const localCards = this.getCards();

      // If remote has cards/decks, merge user progress into local cards
      if (remoteCards.length > 0 || remoteDecks.length > 0) {
        // Merge decks
        const mergedDecksMap = new Map<string, Deck>();
        localDecks.forEach((d) => mergedDecksMap.set(d.id, d));
        remoteDecks.forEach((d) => mergedDecksMap.set(d.id, d));
        this.saveDecks(Array.from(mergedDecksMap.values()));

        // Merge cards by matching ID or Hanzi
        const remoteCardMap = new Map<string, Card>();
        remoteCards.forEach((c) => {
          remoteCardMap.set(c.id, c);
          remoteCardMap.set(`hanzi_${c.hanzi}`, c);
        });

        const mergedCards = localCards.map((localCard) => {
          const matchedRemote = remoteCardMap.get(localCard.id) || remoteCardMap.get(`hanzi_${localCard.hanzi}`);
          if (matchedRemote) {
            return {
              ...localCard,
              interval: matchedRemote.interval ?? localCard.interval,
              repetitions: matchedRemote.repetitions ?? localCard.repetitions,
              easeFactor: matchedRemote.easeFactor ?? localCard.easeFactor,
              dueDate: matchedRemote.dueDate ?? localCard.dueDate,
              lastReviewed: matchedRemote.lastReviewed ?? localCard.lastReviewed,
              status: matchedRemote.status ?? localCard.status,
              updatedAt: matchedRemote.updatedAt ?? localCard.updatedAt,
            };
          }
          return localCard;
        });

        // Add any new custom cards from remote that weren't local
        const localCardIds = new Set(localCards.map((c) => c.id));
        remoteCards.forEach((rc) => {
          if (!localCardIds.has(rc.id) && rc.userId === user.uid) {
            mergedCards.push(rc);
          }
        });

        this.saveCards(mergedCards);
      } else {
        // First-time sync: Upload user's current cards to Firestore so they are stored under their account
        for (const card of localCards.filter((c) => c.status !== 'new' || c.userId === user.uid)) {
          await setDoc(doc(db, 'cards', `${user.uid}_${card.id}`), {
            ...card,
            userId: user.uid,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Sync on login notice:', err);
    }
  }

  // ===== BLACKLIST / USER BAN SERVICE =====
  async checkIsUserBlacklisted(email?: string | null, uid?: string | null): Promise<{ isBanned: boolean; reason?: string }> {
    if (!email && !uid) return { isBanned: false };
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Check local storage blacklist cache
    try {
      const cached = localStorage.getItem('hanzisrs_blacklist');
      if (cached) {
        const list: any[] = JSON.parse(cached);
        const match = list.find((b) => (cleanEmail && b.email?.toLowerCase() === cleanEmail) || (uid && b.userId === uid));
        if (match) {
          return { isBanned: true, reason: match.reason || 'Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.' };
        }
      }
    } catch {}

    // 2. Check Cloud Firestore blacklist
    try {
      const snap = await getDocs(collection(db, 'blacklist'));
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      if (list.length > 0) {
        localStorage.setItem('hanzisrs_blacklist', JSON.stringify(list));
        const match = list.find((b) => (cleanEmail && b.email?.toLowerCase() === cleanEmail) || (uid && b.userId === uid));
        if (match) {
          return { isBanned: true, reason: match.reason || 'Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.' };
        }
      }
    } catch {}

    // 3. Fallback server API
    try {
      const res = await fetch('/api/blacklist');
      const data = await res.json();
      if (data.success && Array.isArray(data.blacklist)) {
        const match = data.blacklist.find((b: any) => (cleanEmail && b.email?.toLowerCase() === cleanEmail) || (uid && b.userId === uid));
        if (match) {
          return { isBanned: true, reason: match.reason || 'Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.' };
        }
      }
    } catch {}

    return { isBanned: false };
  }

  async fetchBlacklist(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'blacklist'));
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      if (list.length > 0) return list;
    } catch {}

    try {
      const res = await fetch('/api/blacklist');
      const data = await res.json();
      if (data.success && Array.isArray(data.blacklist)) {
        return data.blacklist;
      }
    } catch {}

    return [];
  }

  async addToBlacklist(email: string, reason: string, adminUser: User): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: 'Vui lòng nhập email.' };
    const id = `ban-${Date.now()}`;
    const entry = {
      id,
      email: cleanEmail,
      reason: reason.trim() || 'Vi phạm điều khoản cộng đồng',
      bannedBy: adminUser.email || 'Admin',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'blacklist', id), entry);
    } catch (err: any) {
      console.warn('Firestore blacklist write notice:', err);
    }

    try {
      await fetch('/api/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminUser.email || '',
        },
        body: JSON.stringify(entry),
      });
    } catch {}

    return { success: true };
  }

  async removeFromBlacklist(idOrEmail: string, adminUser: User): Promise<{ success: boolean; error?: string }> {
    try {
      await deleteDoc(doc(db, 'blacklist', idOrEmail));
    } catch {}

    try {
      await fetch(`/api/blacklist/${encodeURIComponent(idOrEmail)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-email': adminUser.email || '',
        },
      });
    } catch {}

    return { success: true };
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

  // ===== CLOUD SYSTEM VOCABULARY (Admin Cloud Database) =====
  async fetchSystemVocabFromCloud(): Promise<{ deck: Deck; cards: Card[] } | null> {
    try {
      const snap = await getDoc(doc(db, 'system_vocab', 'hsk1'));
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.deck && Array.isArray(data.cards) && data.cards.length > 0) {
          return {
            deck: data.deck as Deck,
            cards: data.cards as Card[],
          };
        }
      }
    } catch (e) {
      console.warn('Notice loading system vocab from Cloud Firestore:', e);
    }
    return null;
  }

  async saveSystemVocabToCloud(
    deck: Deck,
    cards: Card[],
    user?: any
  ): Promise<{ success: boolean; error?: string }> {
    const email = user?.email?.trim().toLowerCase();
    if (email !== 'phamthemy3008@gmail.com') {
      return { success: false, error: 'Chỉ tài khoản admin phamthemy3008@gmail.com mới có quyền lưu lên Đám mây hệ thống.' };
    }

    try {
      await setDoc(doc(db, 'system_vocab', 'hsk1'), {
        id: 'hsk1',
        deck,
        cards,
        cardCount: cards.length,
        adminEmail: email,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (err: any) {
      console.error('Lỗi khi lưu lên Cloud Firestore:', err);
      return { success: false, error: err.message || 'Lỗi khi lưu lên Đám mây.' };
    }
  }

  // ===== DONATION INFO (Managed only by Admin) =====
  async fetchDonationInfo(): Promise<any> {
    // 1. Try Firestore
    try {
      const snap = await getDoc(doc(db, 'system_config', 'donation'));
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.bankName && data.accountNumber) {
          localStorage.setItem('hoctiengtrung_donation_info_v2', JSON.stringify(data));
          return data;
        }
      }
    } catch {}

    // 2. Fallback to localStorage
    try {
      const saved = localStorage.getItem('hoctiengtrung_donation_info_v2');
      if (saved) return JSON.parse(saved);
    } catch {}

    return null;
  }

  async saveDonationInfo(info: any, user?: any): Promise<{ success: boolean; error?: string }> {
    const email = user?.email?.trim().toLowerCase();
    if (email !== 'phamthemy3008@gmail.com') {
      return { success: false, error: 'Chỉ tài khoản admin phamthemy3008@gmail.com mới có quyền chỉnh sửa mục ủng hộ tác giả.' };
    }

    const payload = {
      ...info,
      updatedAt: new Date().toISOString(),
      updatedBy: email,
    };

    // 1. Save to Cloud Firestore
    try {
      await setDoc(doc(db, 'system_config', 'donation'), payload);
    } catch (err: any) {
      console.warn('Firestore donation config write notice:', err);
    }

    // 2. Cache locally
    try {
      localStorage.setItem('hoctiengtrung_donation_info_v2', JSON.stringify(payload));
    } catch {}

    return { success: true };
  }
}

export const storageService = new StorageService();
