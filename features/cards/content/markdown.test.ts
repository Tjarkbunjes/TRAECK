import { describe, it } from 'vitest';

// Phase 2/5: markdown helpers and deck-file parser (features/cards/content/)
describe('markdown parser', () => {
  it.todo('extracts cloze gaps {{c1::…}} in document order');
  it.todo('renders one card per cloze index with the active gap hidden');
  it.todo('recognises "§ 823 I BGB" and "Art. 12 GG" as norm citations');
  it.todo('parses a content/decks/**/*.md file into cards with front matter');
});
