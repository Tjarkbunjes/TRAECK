// Route table for the cards module. The app is a static export (next.config.ts:
// output "export"), so there are no dynamic segments — ids travel as ?id=…,
// the same way /food/add?edit= and /workout/edit?id= do.

export const CARDS_ROUTES = {
  dashboard: '/cards',
  learn: '/cards/learn',
  decks: '/cards/decks',
  deck: (id: string) => `/cards/decks?id=${encodeURIComponent(id)}`,
  card: (id: string) => `/cards/c?id=${encodeURIComponent(id)}`,
  newCard: '/cards/new',
  stats: '/cards/stats',
  settings: '/cards/settings',
  import: '/cards/import',
} as const;
