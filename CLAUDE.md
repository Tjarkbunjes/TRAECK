# CLAUDE.md

Leitfaden für Claude Code beim Arbeiten in diesem Repository.

## Projekt

TRÆCK ist eine mobile-first Fitness-PWA, mit der eine kleine Nutzergruppe Kalorien, Workouts, Gewicht, Gesundheitsdaten (Garmin/Apple Health) und Ausgaben an einem Ort trackt — ergänzt um ein Spaced-Repetition-Karteikarten-Modul (`/cards`) fürs juristische Referendariat. Das Frontend ist eine statisch exportierte Next.js-App (App Router), die im Browser direkt gegen Supabase (Postgres + Auth + Storage + Edge Functions) spricht — abgesichert ausschließlich über Row Level Security, es gibt keinen eigenen Backend-Server. Zusätzlich wird die gleiche Codebasis via Capacitor als iOS-App gebaut.

## Tech-Stack

Versionen wie in `package.json` deklariert (Semver-Ranges, nicht die aufgelösten Lock-Versionen).

| Bereich | Paket | Version |
|---|---|---|
| Framework | `next` | `16.1.6` (App Router, `output: "export"`) |
| UI-Runtime | `react` / `react-dom` | `19.2.3` |
| Sprache | `typescript` | `^5` (`strict: true`, Target ES2017) |
| Styling | `tailwindcss` / `@tailwindcss/postcss` | `^4` (CSS-first, kein `tailwind.config`) |
| | `tw-animate-css` | `^1.4.0` |
| Komponenten | `radix-ui` | `^1.4.3` (via shadcn/ui, Style `new-york`) |
| | `shadcn` (CLI, devDep) | `^3.8.4` |
| | `class-variance-authority` / `clsx` / `tailwind-merge` | `^0.7.1` / `^2.1.1` / `^3.4.0` |
| Icons | `lucide-react` | `^0.563.0` |
| Backend | `@supabase/supabase-js` | `^2.95.3` |
| | `@supabase/ssr` | `^0.8.0` (als Dependency vorhanden, im Code aktuell **nicht** verwendet) |
| Offline-Storage | `dexie` | `^4.3.0` (lokaler Spiegel + Outbox fürs Karten-Modul) |
| Tests | `vitest` (devDep) | `^3.2.7` |
| Charts | `recharts` | `^3.7.0` |
| Datum | `date-fns` / `react-day-picker` | `^4.1.0` / `^9.13.1` |
| Drag & Drop | `@dnd-kit/core` / `sortable` / `utilities` | `^6.3.1` / `^10.0.0` / `^3.2.2` |
| Toasts | `sonner` | `^2.0.7` |
| Barcode | `barcode-detector` | `^3.0.8` |
| Theme | `next-themes` | `^0.4.6` (nur von `components/ui/sonner.tsx` genutzt) |
| Native | `@capacitor/core` / `cli` / `ios` | `^8.1.0` |
| Lint | `eslint` / `eslint-config-next` | `^9` / `16.1.6` |

Der Paketname in `package.json` ist historisch noch `fittrack` — Produktname ist TRÆCK.

## Ordnerstruktur

| Was | Wo |
|---|---|
| **Routen** | `app/` — Next.js App Router, eine `page.tsx` pro Route. Bestehend: `/` (Karten-Dashboard; zeigt `components/FitnessHome.tsx`, wenn das Fitness-Modul eingeschaltet ist), `/food` (+ `add`, `ai`, `meals`, `scan`), `/workout` (+ `active`, `edit`, `templates`), `/analytics`, `/budget`, `/friends`, `/profile`, `/auth/{login,signup,callback}`, `/cards` (+ `learn`, `decks`, `c`, `new`, `stats`, `settings`, `import`). Root-Layout: `app/layout.tsx`. Wegen `output: "export"` keine dynamischen Segmente — Ids laufen als `?id=` (`/food/add?edit=`, `/cards/decks?id=`). |
| **Komponenten** | `components/` — Feature-Komponenten flach im Ordner (`MacroRings.tsx`, `WorkoutSetRow.tsx`, `FitnessHome.tsx` = das frühere `app/page.tsx`, …); `components/ui/` = generierte shadcn/ui-Primitives (nicht handoptimieren, per shadcn-CLI regenerieren); `components/muscle-svg/` = SVG-Body-Maps. Karten-Komponenten liegen **nicht** hier, sondern in `features/cards/components/`. |
| **Feature-Ordner** | `features/cards/` — der einzige Feature-Ordner; alles Kartenbezogene außer den Seiten in `app/cards/`: `types.ts`, `settings.ts` (+ `useCardsSettings.ts`), `routes.ts`, `repo.ts` (Writes), `sync/` (Worker), `components/`, `scheduler/`, `content/`. Seiten in `app/cards/` sind dünn und importieren von hier. |
| **Supabase-Client** | `lib/supabase.ts` — ein einziger, global exportierter Browser-Client (`export const supabase`), gespeist aus `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Kein Server-Client. |
| **Module-Schalter** | `lib/modules.ts` (+ `lib/use-modules.ts`) — `profiles.settings.modules.fitness` (Default `false`). Steuert, ob `components/BottomNav.tsx` die Fitness-Tabs oder die Karten-Tabs (`heute · decks · neu · statistik · mehr`) zeigt und was `/` rendert. Umschalten unter `/cards/settings`. Die Fitness-Routen bleiben immer per URL erreichbar. |
| **Datenzugriff** | `lib/hooks.ts` — sämtliche Read/Write-Hooks (`useAuth`, `useProfile`, `useFoodEntries`, `useWorkouts`, `useManualExpenses`, …). Zentrale Datei des Projekts (~670 Zeilen). |
| **Typen** | `lib/types.ts` — Row-Interfaces spiegeln 1:1 die Supabase-Tabellen, plus Label-/Kategorie-Konstanten. |
| **Dexie-Schema** | `lib/db.ts` — Dexie-DB `FitTrackDB`, aktuell v3: `recentFoods`, `pendingSync` (Outbox), `decks`, `cards`, `card_state` (Compound-Key `[card_id+variant]`), `reviews`, `syncMeta` (Sync-Cursor). Neue Tabellen = neue `db.version(n)`, bestehende Versionen nie editieren. |
| **Sync-Worker** | `features/cards/sync/syncWorker.ts` — **nur für die vier Karten-Tabellen.** Pull (Delta über `updated_at`/`reviewed_at`, newer-wins, Cursor in `syncMeta`) → Push der `pendingSync`-Outbox in Reihenfolge. `requestSync()` koalesziert parallele Aufrufe; `useCardsSync()` triggert bei Mount, `online` und `visibilitychange`. Fremde `pendingSync`-Einträge werden ignoriert. Fitness-Daten laufen **nicht** über diesen Worker. |
| **Service Worker** | `public/sw.js` — handgeschrieben, network-first mit Cache-Fallback für GET-Navigation; registriert in `components/PWAInstall.tsx`. Nur Asset-/Seiten-Caching, keine Write-Queue. |
| **Theme-Provider** | **Existiert nicht.** Dark Mode ist in `app/layout.tsx` fest verdrahtet (`<html lang="en" className="dark">`); `next-themes` wird ausschließlich von `components/ui/sonner.tsx` konsumiert. Wer Theme-Switching braucht, muss den Provider erst einführen. |
| **Design-Tokens** | `app/globals.css` — Tailwind-v4 `@theme inline`-Mapping plus die Token-Werte in `:root` (Light) und `.dark` (aktiv), überwiegend `oklch()`. Dort liegen auch `--radius`, die Chart-Farben `--chart-1…5` und die Button-/Secondary-Gradients im `@layer base`. |
| **Migrationen** | `supabase/migration_*.sql` (plus `supabase/seed_default_templates.sql`) — rohe SQL-Dateien, manuell im Supabase SQL Editor auszuführen. Es gibt **keine** Supabase-CLI-Migrationskette und keinen Timestamp-Prefix. Karten: `migration_cards.sql` (4 Tabellen + `profiles.settings`). |
| **Karten-Content** | `content/FORMAT.md` (Kartenformat: Frontmatter + `## feld`-Abschnitte, `---` als Trenner) und `content/decks/<rechtsgebiet>/` mit `_deck.yaml` + `*.md`. Wird in Phase 5 per `npm run cards:import` importiert. |
| **Skills** | `.claude/skills/karteikarten/SKILL.md` — Workflow für „erstelle Karten zu <Thema>". |
| **Edge Functions** | `supabase/functions/<name>/index.ts` (Deno) — `analyze-food`, `categorize-transactions`. Aus `tsconfig.json` bewusst ausgeschlossen. |
| **Skripte** | `scripts/` — `import-csv.mjs` (Kreditkarten-Import), `sync_garmin.py` (läuft via `.github/workflows/garmin-sync.yml`). |
| **iOS** | `ios/` — Capacitor-Projekt, Konfiguration in `capacitor.config.ts`. |

Import-Alias: `@/*` → Repo-Root (`tsconfig.json`), also `@/lib/hooks`, `@/components/ui/button`.

## Konventionen

### Naming

- Komponenten-Dateien: `PascalCase.tsx` (`FoodEntryCard.tsx`), shadcn-Primitives in `components/ui/` bleiben `kebab-case.tsx` (`dropdown-menu.tsx`).
- Alles in `lib/`: `kebab-case.ts` (`food-api.ts`, `default-templates.ts`).
- Routen: `app/<segment>/page.tsx`, Segmente kleingeschrieben.
- Hooks: `useThing`, benannt nach der Tabelle/Domäne, nicht nach der Seite.
- DB-Felder und alles, was aus Supabase kommt, ist `snake_case` und wird **nicht** in camelCase umbenannt — `entry.serving_grams` bleibt so bis in die JSX.
- Migrationen: `supabase/migration_<thema>[_v2|_v3].sql`.
- Sichtbarer UI-Text ist durchgehend kleingeschrieben (`'food'`, `'add entry'`) — dieser Stil ist Absicht, siehe `components/BottomNav.tsx`.

### Komponentenstil

- Praktisch alles ist Client-seitig: `'use client'` als erste Zeile jeder Seite und jeder interaktiven Komponente. Wegen `output: "export"` gibt es keine Server Actions und keine Route Handler — Datenzugriff passiert immer im Browser gegen Supabase.
- `export function Component()` (named export) für Komponenten; Seiten sind `export default function XyzPage()`.
- Klassen immer über `cn()` aus `@/lib/utils` zusammensetzen, nie per String-Konkatenation.
- Styling ausschließlich über Tailwind-Utilities und die Token-Namen (`bg-card`, `text-muted-foreground`, `border-border`). Neue Farben gehören als Token nach `app/globals.css`, nicht als Hex-Wert in die Komponente.
- Icons aus `lucide-react`, Toasts über `toast.*` aus `sonner`.
- Mobile-first: max. `max-w-md`-Container, Touch-Targets ≥ 44px, Safe-Area über `env(safe-area-inset-*)` berücksichtigen (siehe `app/layout.tsx` und `components/BottomNav.tsx`).

### Writes — zwei Muster, nicht mischen

**Fitness (Food, Workout, Budget, …): optimistisch, direkt gegen Supabase.** Nicht offline-fähig; offline greift nur der Service-Worker-Cache für GET. Referenz: `useManualExpenses` in `lib/hooks.ts` (`addExpense` / `removeExpense`):

1. `const { data: { user } } = await supabase.auth.getUser()`; bei `!user` still abbrechen.
2. Schreiben mit `.insert({ user_id: user.id, ... }).select().single()` — `user_id` immer explizit, weil RLS darauf prüft.
3. Nur bei `!error` den lokalen State per funktionalem Update anpassen (`setExpenses(prev => [...prev, data])`).
4. Den `error` an den Aufrufer zurückgeben; die Seite zeigt ihn per `toast.error(...)`.
5. Der Hook exportiert `{ items, loading, load/refresh, mutatoren }` — Seiten rufen nie direkt `supabase` für CRUD auf, wenn ein Hook existiert.

**Karten (`features/cards/`): local-first.** Referenz: `features/cards/repo.ts` (`putDeck`, `putCard`, `softDeleteCard`, `putCardState`, `addReview`):

1. Vollständige Zeile inkl. `user_id` bauen; `updated_at` setzt `repo.ts` selbst (`nowIso()`), Ids kommen aus `newId()`.
2. `db.<tabelle>.put(row)` — IndexedDB zuerst, die UI reagiert sofort.
3. `enqueue(tabelle, action, key)` schreibt **nur den Primärschlüssel** in `pendingSync`; der Worker liest beim Push die aktuelle lokale Zeile.
4. `emitCardsChanged()` + `requestSync()` — Hooks, die auf `onCardsChanged` hören, lesen Dexie neu.
5. Karten werden **soft-deleted** (`deleted_at`), damit die Löschung wie jede Änderung synct. Konflikt: neuerer `updated_at` gewinnt, lokal bei Gleichstand.

Seiten unter `app/cards/` rufen nie `supabase.from('decks'|'cards'|…)` direkt auf — Lesen aus Dexie, Schreiben über `repo.ts`. Einzige Ausnahme: `useCardsSettings`, das `profiles.settings` direkt liest/schreibt (und nur den `cards`-Teilbaum ersetzt).

### Neue Migrationen anlegen

1. Neue Datei `supabase/migration_<thema>.sql` anlegen (Erweiterung eines bestehenden Themas: `_v2`, `_v3`, … anhängen — siehe `migration_journal_v2.sql`).
2. Kopfkommentar mit einem Satz Zweck + `-- Run this migration in Supabase SQL Editor`.
3. Idempotent formulieren: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
4. Für jede neue Tabelle zwingend: `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` und vier Policies (SELECT/INSERT/UPDATE/DELETE) gegen `auth.uid() = user_id`. Ohne RLS ist die Tabelle offen, es gibt keine Server-Schicht davor.
5. Index auf die typische Abfrage setzen, meist `(user_id, date)`.
6. Passendes Interface in `lib/types.ts` ergänzen (Karten-Tabellen: `features/cards/types.ts`) — Feldnamen exakt wie in SQL, Nullables als `| null`.
7. Die Datei wird **manuell** im Supabase SQL Editor ausgeführt — es läuft nichts automatisch. In der PR-Beschreibung erwähnen, dass eine Migration aussteht.

Vorlage: `supabase/migration_manual_expenses.sql` (neue Tabelle), `supabase/migration_journal_v2.sql` (Spalten nachziehen), `supabase/migration_cards.sql` (mehrere Tabellen, Compound-PK, `jsonb`-Spalte).

Karten-Tabellen zusätzlich: `updated_at timestamptz NOT NULL DEFAULT now()` (Sync-Cursor + LWW), Index `(user_id, updated_at)`, und der Dexie-Spiegel in `lib/db.ts` bekommt eine neue `db.version(n)`.

## Befehle

```bash
npm install        # Abhängigkeiten
npm run dev        # next dev — Entwicklungsserver auf :3000
npm run build      # next build — statischer Export nach out/
npm run lint       # eslint (Flat Config, eslint.config.mjs)
npm test           # vitest run — features/**/*.test.{ts,tsx}, lib/**/*.test.ts
npm run start      # next start
npm run build:ios  # next build && cap sync ios
npm run open:ios   # Xcode öffnen
npx tsc --noEmit   # Typecheck (kein eigenes npm-Skript)
```

**Tests:** Vitest (`vitest.config.ts`, Node-Environment, Alias `@`) für `features/**` und `lib/**`. Getestet werden reine Funktionen (Settings-Parser, Merge-Helfer, Deck-Baum, Varianten/Cloze, Norm-Regex, Module-Resolver) plus Render-Smoke-Tests per `renderToStaticMarkup` (`components.test.tsx`, `markdown.test.tsx`) — kein Dexie, kein Supabase, keine Interaktion. Fitness-Code hat keine Tests. Vor jedem Push: `npm run lint`, `npx tsc --noEmit`, `npm test`.

**Lint-Baseline:** `npm run lint` meldet auf `main` 25 Fehler / 40 Warnungen (alle in Fitness-Dateien, v. a. `react-hooks/set-state-in-effect` in `lib/hooks.ts`). Diese Zahl darf nicht steigen; neue Dateien müssen sauber sein (`npx eslint <pfad>`).

Benötigte Env-Variablen in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Modul: Karteikarten (`/cards`)

Spaced-Repetition-Karteikarten (Anki-Prinzip, FSRS via `ts-fsrs`) fürs zweite Staatsexamen. Wird in Phasen gebaut, jede Phase auf einem eigenen Branch `feat/cards-phase-N`; immer nur die genannte Phase bauen.

| Phase | Stand | Inhalt |
|---|---|---|
| 1 | ✅ gemergt | Migration, Dexie v3, Sync-Worker, Routen-Gerüst, `CardsSettings`, Vitest |
| 2 | ✅ gemergt | Decks + Karten CRUD, Deck-Baum, Markdown-Editor, alle 5 Kartentypen rendern, Suche/Filter, Soft Delete (`migration_cards_v2.sql`: `decks.deleted_at`) |
| 3 | offen | Lernmodus: Queue-Builder, `ts-fsrs`-Wrapper, Bewertung, Reviews, Session |
| 4 | offen | Personalisierung komplett (Settings-Screen, Presets, Gesten, Haptik, Typografie, Accent) |
| 5 | offen | Content-Pipeline: `content/decks/**/*.md` → `cards:check` / `cards:import`, Import-Wizard |
| 6 | offen | Statistik, Heatmap, Leech-Handling, Nachhol-Verteilung, Vorziehen, Fokusmodus |
| 7 | optional | Claude-API-Route: umformulieren, Schema → Einzelkarten, Cloze-Vorschläge |
| 8 | offen | Polish: SW-Caching für `/cards`, Light Mode, Desktop-Layout, `.apkg`-Import |

**Die App ist nach außen die Karteikarten-App.** Fitness ist per Default ausgeblendet (siehe Module-Schalter), der Code bleibt aber vollständig erhalten und wird **nicht angefasst**. Das Modul ist additiv: `app/cards/**`, `features/cards/**`, eigene Tabellen. `app/food/**`, `app/workout/**`, `app/analytics/**`, `app/budget/**`, die Hooks in `lib/hooks.ts` und die Fitness-Typen in `lib/types.ts` bleiben unverändert. Gemeinsam genutzt werden nur die neutralen Bausteine: `lib/supabase.ts`, `lib/db.ts` (neue Version anhängen), `components/ui/*`, `lib/utils.ts`, Design-Tokens. Änderungen an Shared-Code bisher: `components/BottomNav.tsx` (zwei Tab-Sets je nach Modul-Schalter), `app/page.tsx` (Weiche) und der Umzug des Fitness-Dashboards nach `components/FitnessHome.tsx`. Gemeinsame Komponenten bei Bedarf nach `features/cards/components/` kopieren und dort anpassen, nicht im Original ändern.

**Einstellungen liegen unter `profiles.settings.cards`.** Die Spalte `profiles.settings jsonb` existiert seit `migration_cards.sql`. Shape, Defaults und Parser: `features/cards/settings.ts` (`CardsSettings`, `DEFAULT_CARDS_SETTINGS`, `resolveCardsSettings`). Schreiben nur über `useCardsSettings().save()`, das per `withCardsSettings()` ausschließlich den `cards`-Teilbaum ersetzt — nie das gesamte `settings`-Objekt. Neue Optionen: Typ + Default + Parser-Zweig + Test in `settings.test.ts`.

**Datenmodell-Entscheidungen, die bleiben:**
- `card_state` hat den PK `(card_id, variant)`: `basic`/`schema`/`streitstand` → `fwd`, `reverse` → `fwd` + `rev`, `cloze` → `c1`, `c2`, … `reviews` trägt dieselbe `variant`.
- `Card` ist auf `type` diskriminiert; `fields` ist je Typ getypt (`features/cards/types.ts`). Kein `any`.
- `decks` und `cards` werden **soft-deleted** (`deleted_at`); `softDeleteDeck()` kaskadiert auf Unterdecks und Karten. Nie hart löschen — das würde per Delta-Sync nicht propagieren.
- `schema`-Karten: `deck.fsrs_params.schema_mode` (`whole` → Variante `fwd`, `steps` → `s1…sn`). `saveCard()` gleicht `card_state` mit `variantsForCard()` ab.

**Design im Modul:** Repo-Tokens für Flächen (`bg-card`, `border-border`), Modul-Accent als CSS-Variable `--cards-accent` (Default `#3DFBB0`, nur innerhalb von `CardsScreen` gesetzt), Lucide-Icons mit `strokeWidth={1.5}`, Zahlen/Intervalle in `font-mono`, UI-Texte kleingeschrieben und auf Deutsch (`karten`, `lernen`, `fällig`). Ruhig, keine Gamification.

**Abhängigkeiten:** nur `ts-fsrs`, `react-markdown`, `remark-gfm` sind zusätzlich erlaubt (plus Zustand, falls ein Store nötig wird) — jeweils erst in der Phase installieren, die sie braucht.
