import fs from 'fs';
import path from 'path';
import { INITIAL_DECKS, INITIAL_CARDS } from '../src/data/defaultDecks';

const DATA_FILE = path.resolve(process.cwd(), 'src/data/systemVocab.json');

// In-memory server store for system vocabulary (can be updated or queried)
let systemDecks = [...INITIAL_DECKS];
let systemCards = [...INITIAL_CARDS];

// Try loading persisted data on startup
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.decks) && parsed.decks.length > 0) {
      systemDecks = parsed.decks;
    }
    if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      systemCards = parsed.cards;
    }
  }
} catch (e) {
  console.warn('Could not read systemVocab.json:', e);
}

export function getSystemDecksAndCards() {
  return {
    decks: systemDecks,
    cards: systemCards,
  };
}

export function saveSystemVocab(newDecks: any[], newCards: any[]) {
  if (Array.isArray(newDecks) && newDecks.length > 0) {
    systemDecks = [...newDecks.map((d) => ({ ...d, isSystem: true, userId: 'system' }))];
  }
  if (Array.isArray(newCards)) {
    systemCards = [...newCards.map((c) => ({ ...c, userId: 'system' }))];
  }

  // Persist to file
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ decks: systemDecks, cards: systemCards }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to write systemVocab.json:', err);
  }

  return {
    success: true,
    totalDecks: systemDecks.length,
    totalCards: systemCards.length,
    decks: systemDecks,
    cards: systemCards,
  };
}

export function resetSystemVocabToDefault() {
  systemDecks = [...INITIAL_DECKS];
  systemCards = [...INITIAL_CARDS];
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
  } catch {}
  return {
    success: true,
    totalDecks: systemDecks.length,
    totalCards: systemCards.length,
    decks: systemDecks,
    cards: systemCards,
  };
}

export const importSystemCards = saveSystemVocab;

