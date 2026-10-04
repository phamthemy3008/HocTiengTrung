import { INITIAL_DECKS, INITIAL_CARDS } from '../src/data/defaultDecks';

// In-memory server store for system vocabulary (can be updated or queried)
let systemDecks = [...INITIAL_DECKS];
let systemCards = [...INITIAL_CARDS];

export function getSystemDecksAndCards() {
  return {
    decks: systemDecks,
    cards: systemCards,
  };
}

export function importSystemCards(newDecks: any[], newCards: any[]) {
  if (Array.isArray(newDecks) && newDecks.length > 0) {
    systemDecks = [...newDecks.map((d) => ({ ...d, isSystem: true, userId: 'system' }))];
  }
  if (Array.isArray(newCards) && newCards.length > 0) {
    systemCards = [...newCards.map((c) => ({ ...c, userId: 'system' }))];
  }
  return {
    success: true,
    totalDecks: systemDecks.length,
    totalCards: systemCards.length,
  };
}
