// Cards settings live in profiles.settings.cards (jsonb). This file owns the
// shape, the defaults and the tolerant parser that turns whatever is stored
// into a complete CardsSettings — unknown keys are dropped, invalid values
// fall back to the default, missing branches are filled in.

export const CARDS_ACCENT_DEFAULT = '#3DFBB0';

export const CARDS_ACCENT_PRESETS = [
  '#3DFBB0', // arctic mint
  '#0096FF', // traeck blue
  '#FFB84D', // amber
  '#FF6B8A', // coral
  '#B78CFF', // violet
  '#E8E8E8', // mono
] as const;

export const THEME_MODES = ['dark', 'light', 'system'] as const;
export const CONTRASTS = ['normal', 'high'] as const;
export const FONT_SIZES = ['S', 'M', 'L', 'XL'] as const;
export const FONT_FAMILIES = ['inter', 'serif', 'mono'] as const;
export const LINE_HEIGHTS = ['tight', 'normal', 'relaxed'] as const;
export const REVEAL_MODES = ['tap', 'swipe-up', 'long-press'] as const;
export const RATING_MODES = ['four', 'two', 'swipe'] as const;
export const AUTO_ADVANCE = [0, 300, 'manual'] as const;
export const ALIGNMENTS = ['center', 'left'] as const;
export const SESSION_ORDERS = ['due-first', 'new-first', 'mixed'] as const;
export const DECK_ORDERS = ['interleaved', 'sequential'] as const;
export const DASHBOARD_WIDGETS = ['queue', 'streak', 'heatmap', 'retention', 'decks'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type FontSize = (typeof FONT_SIZES)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];
export type LineHeight = (typeof LINE_HEIGHTS)[number];
export type RevealMode = (typeof REVEAL_MODES)[number];
export type RatingMode = (typeof RATING_MODES)[number];
export type AutoAdvance = (typeof AUTO_ADVANCE)[number];
export type Alignment = (typeof ALIGNMENTS)[number];
export type SessionOrder = (typeof SESSION_ORDERS)[number];
export type DeckOrder = (typeof DECK_ORDERS)[number];
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];

export interface CardsThemeSettings {
  accent: string;
  mode: ThemeMode;
  contrast: Contrast;
}

export interface CardsTypographySettings {
  size: FontSize;
  family: FontFamily;
  lineHeight: LineHeight;
}

export interface CardsInteractionSettings {
  reveal: RevealMode;
  rating: RatingMode;
  /** keys 1–4 rate the card on desktop, independent of `rating` */
  keyboardShortcuts: boolean;
  intervalPreview: boolean;
  haptics: boolean;
  autoAdvance: AutoAdvance;
}

export interface CardsLayoutSettings {
  align: Alignment;
  divider: boolean;
  showSource: boolean;
  showTags: boolean;
}

export interface CardsSessionSettings {
  timeBudgetMin: number;
  order: SessionOrder;
  deckOrder: DeckOrder;
  /** null = no reminder */
  breakReminderMin: number | null;
}

export interface CardsSchedulerSettings {
  /** FSRS request retention, 0.7–0.98; decks may override via fsrs_params */
  requestRetention: number;
  maximumIntervalDays: number;
  leechThreshold: number;
}

export interface CardsDashboardSettings {
  /** ordered list of visible widgets */
  widgets: DashboardWidget[];
}

/** Everything a preset can capture (all settings except the presets themselves). */
export interface CardsSettingsPreset {
  theme: CardsThemeSettings;
  typography: CardsTypographySettings;
  interaction: CardsInteractionSettings;
  layout: CardsLayoutSettings;
  session: CardsSessionSettings;
  scheduler: CardsSchedulerSettings;
  dashboard: CardsDashboardSettings;
}

export interface CardsSettings extends CardsSettingsPreset {
  presets: Record<string, CardsSettingsPreset>;
  activePreset: string | null;
}

export const DEFAULT_CARDS_PRESET: CardsSettingsPreset = {
  theme: { accent: CARDS_ACCENT_DEFAULT, mode: 'dark', contrast: 'normal' },
  typography: { size: 'M', family: 'inter', lineHeight: 'normal' },
  interaction: {
    reveal: 'tap',
    rating: 'four',
    keyboardShortcuts: true,
    intervalPreview: true,
    haptics: true,
    autoAdvance: 300,
  },
  layout: { align: 'center', divider: true, showSource: true, showTags: false },
  session: { timeBudgetMin: 25, order: 'due-first', deckOrder: 'interleaved', breakReminderMin: null },
  scheduler: { requestRetention: 0.9, maximumIntervalDays: 365, leechThreshold: 8 },
  dashboard: { widgets: ['queue', 'streak', 'heatmap', 'retention', 'decks'] },
};

export const DEFAULT_CARDS_SETTINGS: CardsSettings = {
  ...DEFAULT_CARDS_PRESET,
  presets: {},
  activePreset: null,
};

// ── parsing ──────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

function nullableNum(v: unknown, fallback: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function hexColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX_COLOR.test(v) ? v : fallback;
}

function widgets(v: unknown, fallback: DashboardWidget[]): DashboardWidget[] {
  if (!Array.isArray(v)) return fallback;
  const seen = new Set<DashboardWidget>();
  for (const item of v) {
    if ((DASHBOARD_WIDGETS as readonly unknown[]).includes(item)) seen.add(item as DashboardWidget);
  }
  return [...seen];
}

function parsePreset(raw: unknown, base: CardsSettingsPreset): CardsSettingsPreset {
  const r = isRecord(raw) ? raw : {};
  const theme = isRecord(r.theme) ? r.theme : {};
  const typography = isRecord(r.typography) ? r.typography : {};
  const interaction = isRecord(r.interaction) ? r.interaction : {};
  const layout = isRecord(r.layout) ? r.layout : {};
  const session = isRecord(r.session) ? r.session : {};
  const scheduler = isRecord(r.scheduler) ? r.scheduler : {};
  const dashboard = isRecord(r.dashboard) ? r.dashboard : {};

  return {
    theme: {
      accent: hexColor(theme.accent, base.theme.accent),
      mode: oneOf(theme.mode, THEME_MODES, base.theme.mode),
      contrast: oneOf(theme.contrast, CONTRASTS, base.theme.contrast),
    },
    typography: {
      size: oneOf(typography.size, FONT_SIZES, base.typography.size),
      family: oneOf(typography.family, FONT_FAMILIES, base.typography.family),
      lineHeight: oneOf(typography.lineHeight, LINE_HEIGHTS, base.typography.lineHeight),
    },
    interaction: {
      reveal: oneOf(interaction.reveal, REVEAL_MODES, base.interaction.reveal),
      rating: oneOf(interaction.rating, RATING_MODES, base.interaction.rating),
      keyboardShortcuts: bool(interaction.keyboardShortcuts, base.interaction.keyboardShortcuts),
      intervalPreview: bool(interaction.intervalPreview, base.interaction.intervalPreview),
      haptics: bool(interaction.haptics, base.interaction.haptics),
      autoAdvance: oneOf(interaction.autoAdvance, AUTO_ADVANCE, base.interaction.autoAdvance),
    },
    layout: {
      align: oneOf(layout.align, ALIGNMENTS, base.layout.align),
      divider: bool(layout.divider, base.layout.divider),
      showSource: bool(layout.showSource, base.layout.showSource),
      showTags: bool(layout.showTags, base.layout.showTags),
    },
    session: {
      timeBudgetMin: num(session.timeBudgetMin, base.session.timeBudgetMin, 1, 600),
      order: oneOf(session.order, SESSION_ORDERS, base.session.order),
      deckOrder: oneOf(session.deckOrder, DECK_ORDERS, base.session.deckOrder),
      breakReminderMin: nullableNum(session.breakReminderMin, base.session.breakReminderMin, 1, 600),
    },
    scheduler: {
      requestRetention: num(scheduler.requestRetention, base.scheduler.requestRetention, 0.7, 0.98),
      maximumIntervalDays: num(scheduler.maximumIntervalDays, base.scheduler.maximumIntervalDays, 1, 36500),
      leechThreshold: num(scheduler.leechThreshold, base.scheduler.leechThreshold, 2, 100),
    },
    dashboard: {
      widgets: widgets(dashboard.widgets, base.dashboard.widgets),
    },
  };
}

/**
 * Turn the stored `profiles.settings.cards` value (or anything else) into a
 * complete CardsSettings. Never throws.
 */
export function resolveCardsSettings(raw: unknown): CardsSettings {
  const r = isRecord(raw) ? raw : {};
  const presets: Record<string, CardsSettingsPreset> = {};
  if (isRecord(r.presets)) {
    for (const [name, preset] of Object.entries(r.presets)) {
      if (name.trim() && isRecord(preset)) presets[name] = parsePreset(preset, DEFAULT_CARDS_PRESET);
    }
  }
  const activePreset = typeof r.activePreset === 'string' && r.activePreset in presets ? r.activePreset : null;
  return { ...parsePreset(r, DEFAULT_CARDS_PRESET), presets, activePreset };
}

/** Read the cards subtree out of a whole `profiles.settings` object. */
export function cardsSettingsFromProfileSettings(profileSettings: unknown): CardsSettings {
  return resolveCardsSettings(isRecord(profileSettings) ? profileSettings.cards : undefined);
}

/**
 * Produce the new `profiles.settings` value with only the `cards` subtree
 * replaced — other modules' keys are preserved untouched.
 */
export function withCardsSettings(profileSettings: unknown, cards: CardsSettings): Record<string, unknown> {
  const existing = isRecord(profileSettings) ? profileSettings : {};
  return { ...existing, cards };
}
