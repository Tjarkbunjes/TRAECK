# CLAUDE.md

Leitfaden für Claude Code beim Arbeiten in diesem Repository.

## Projekt

TRÆCK ist eine mobile-first Fitness-PWA, mit der eine kleine Nutzergruppe Kalorien, Workouts, Gewicht, Gesundheitsdaten (Garmin/Apple Health) und Ausgaben an einem Ort trackt. Das Frontend ist eine statisch exportierte Next.js-App (App Router), die im Browser direkt gegen Supabase (Postgres + Auth + Storage + Edge Functions) spricht — abgesichert ausschließlich über Row Level Security, es gibt keinen eigenen Backend-Server. Zusätzlich wird die gleiche Codebasis via Capacitor als iOS-App gebaut.

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
| Offline-Storage | `dexie` | `^4.3.0` |
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
| **Routen** | `app/` — Next.js App Router, eine `page.tsx` pro Route. Bestehend: `/` (Dashboard), `/food` (+ `add`, `ai`, `meals`, `scan`), `/workout` (+ `active`, `edit`, `templates`), `/analytics`, `/budget`, `/friends`, `/profile`, `/auth/{login,signup,callback}`. Root-Layout: `app/layout.tsx`. |
| **Komponenten** | `components/` — Feature-Komponenten flach im Ordner (`MacroRings.tsx`, `WorkoutSetRow.tsx`, …); `components/ui/` = generierte shadcn/ui-Primitives (nicht handoptimieren, per shadcn-CLI regenerieren); `components/muscle-svg/` = SVG-Body-Maps. |
| **Supabase-Client** | `lib/supabase.ts` — ein einziger, global exportierter Browser-Client (`export const supabase`), gespeist aus `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Kein Server-Client. |
| **Datenzugriff** | `lib/hooks.ts` — sämtliche Read/Write-Hooks (`useAuth`, `useProfile`, `useFoodEntries`, `useWorkouts`, `useManualExpenses`, …). Zentrale Datei des Projekts (~670 Zeilen). |
| **Typen** | `lib/types.ts` — Row-Interfaces spiegeln 1:1 die Supabase-Tabellen, plus Label-/Kategorie-Konstanten. |
| **Dexie-Schema** | `lib/db.ts` — Dexie-DB `FitTrackDB`, aktuell v2, Tabellen `recentFoods` und `pendingSync`. |
| **Sync-Worker** | **Existiert nicht.** Es gibt keinen Sync-Worker und keinen Code, der `pendingSync` liest oder schreibt — die Tabelle ist im Schema deklariert, aber ungenutzt (siehe „Offline-First-Writes"). |
| **Service Worker** | `public/sw.js` — handgeschrieben, network-first mit Cache-Fallback für GET-Navigation; registriert in `components/PWAInstall.tsx`. Nur Asset-/Seiten-Caching, keine Write-Queue. |
| **Theme-Provider** | **Existiert nicht.** Dark Mode ist in `app/layout.tsx` fest verdrahtet (`<html lang="en" className="dark">`); `next-themes` wird ausschließlich von `components/ui/sonner.tsx` konsumiert. Wer Theme-Switching braucht, muss den Provider erst einführen. |
| **Design-Tokens** | `app/globals.css` — Tailwind-v4 `@theme inline`-Mapping plus die Token-Werte in `:root` (Light) und `.dark` (aktiv), überwiegend `oklch()`. Dort liegen auch `--radius`, die Chart-Farben `--chart-1…5` und die Button-/Secondary-Gradients im `@layer base`. |
| **Migrationen** | `supabase/migration_*.sql` (plus `supabase/seed_default_templates.sql`) — rohe SQL-Dateien, manuell im Supabase SQL Editor auszuführen. Es gibt **keine** Supabase-CLI-Migrationskette und keinen Timestamp-Prefix. |
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

### Offline-First-Writes

Ehrlicher Ist-Zustand: **Writes sind derzeit nicht offline-fähig.** Es gibt zwar `lib/db.ts` mit einer `pendingSync`-Tabelle (Felder `table`, `action`, `data`, `created_at`), aber keinerlei Code, der sie befüllt oder abarbeitet. Offline greift nur der Service-Worker-Cache für GET-Requests.

Was tatsächlich existiert, ist ein durchgängiges **optimistisches Write-Muster** in den Hooks. Referenz-Beispiel: `useManualExpenses` in `lib/hooks.ts` (`addExpense` / `removeExpense`, ca. Zeile 597–646). Das Muster ist:

1. `const { data: { user } } = await supabase.auth.getUser()`; bei `!user` still abbrechen.
2. Schreiben mit `.insert({ user_id: user.id, ... }).select().single()` — `user_id` wird immer explizit mitgegeben, weil RLS darauf prüft.
3. Nur bei `!error` den lokalen State per funktionalem Update anpassen (`setExpenses(prev => [...prev, data])`), damit die UI ohne Refetch aktuell ist.
4. Den `error` an den Aufrufer zurückgeben; die Seite zeigt ihn per `toast.error(...)` an.
5. Der Hook exportiert `{ items, loading, load/refresh, mutatoren }` — Seiten rufen nie direkt `supabase` für CRUD auf, wenn ein Hook existiert (`app/food/add/page.tsx` ist die Ausnahme für Einmal-Formulare).

Wer echte Offline-Writes einführt, baut den Queue-Drain um `pendingSync` herum und ersetzt Schritt 2–4, statt das Muster nebenher zu duplizieren.

### Neue Migrationen anlegen

1. Neue Datei `supabase/migration_<thema>.sql` anlegen (Erweiterung eines bestehenden Themas: `_v2`, `_v3`, … anhängen — siehe `migration_journal_v2.sql`).
2. Kopfkommentar mit einem Satz Zweck + `-- Run this migration in Supabase SQL Editor`.
3. Idempotent formulieren: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
4. Für jede neue Tabelle zwingend: `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` und vier Policies (SELECT/INSERT/UPDATE/DELETE) gegen `auth.uid() = user_id`. Ohne RLS ist die Tabelle offen, es gibt keine Server-Schicht davor.
5. Index auf die typische Abfrage setzen, meist `(user_id, date)`.
6. Passendes Interface in `lib/types.ts` ergänzen (Feldnamen exakt wie in SQL, Nullables als `| null`).
7. Die Datei wird **manuell** im Supabase SQL Editor ausgeführt — es läuft nichts automatisch. In der PR-Beschreibung erwähnen, dass eine Migration aussteht.

Vorlage: `supabase/migration_manual_expenses.sql` (neue Tabelle), `supabase/migration_journal_v2.sql` (Spalten nachziehen).

## Befehle

```bash
npm install        # Abhängigkeiten
npm run dev        # next dev — Entwicklungsserver auf :3000
npm run build      # next build — statischer Export nach out/
npm run lint       # eslint (Flat Config, eslint.config.mjs)
npm run start      # next start
npm run build:ios  # next build && cap sync ios
npm run open:ios   # Xcode öffnen
npx tsc --noEmit   # Typecheck (kein eigenes npm-Skript)
```

**Tests: es gibt keine.** Kein `test`-Skript, kein Test-Runner, keine `*.test.*`-Dateien im Repo. Änderungen bitte mit `npm run lint` **und** `npx tsc --noEmit` absichern; wer Tests einführt, ergänzt hier das Skript.

Benötigte Env-Variablen in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Geplantes Modul: Karteikarten (`/cards`)

Geplant ist ein eigenständiges Lern-/Karteikarten-Modul unter der Route `/cards`.

**Fitness-Code wird dabei nicht angefasst.** Das Karteikarten-Modul ist additiv: eigene Routen unter `app/cards/`, eigene Komponenten, eigene Hooks, eigene Tabellen. Bestehende Fitness-, Food-, Analytics- und Budget-Dateien (`app/food/**`, `app/workout/**`, `app/analytics/**`, `app/budget/**`, die zugehörigen Hooks in `lib/hooks.ts`, die Fitness-Typen in `lib/types.ts`) bleiben unverändert. Gemeinsam genutzt werden nur die neutralen Bausteine: `lib/supabase.ts`, `components/ui/*`, `lib/utils.ts` und die Design-Tokens. Ausnahme, die zwangsläufig geteilt wird: `components/BottomNav.tsx` bzw. die Navigation braucht einen Eintrag — das ist eine Ergänzung der `navItems`-Liste, kein Umbau.

**Einstellungen liegen unter `profiles.settings.cards`.** Die Karten-Konfiguration (z. B. Lernparameter, Deck-Defaults, Anzeigeoptionen) wird nicht in eigene Settings-Tabellen ausgelagert, sondern als verschachteltes Objekt im `settings`-JSONB der `profiles`-Zeile abgelegt — alles Karten-Bezogene ausschließlich unterhalb des Schlüssels `cards`, damit spätere Module denselben Container ohne Kollision mitnutzen können.

Hinweis zum Stand: Die Spalte `profiles.settings` existiert heute **noch nicht** (weder in `supabase/migration_*.sql` noch im `Profile`-Interface in `lib/types.ts`). Sie muss als erster Schritt per neuer Migration angelegt werden (`settings jsonb NOT NULL DEFAULT '{}'::jsonb`), und `Profile` in `lib/types.ts` ist entsprechend zu erweitern. Beim Schreiben immer nur den `cards`-Teilbaum mergen, nie das gesamte `settings`-Objekt überschreiben.
