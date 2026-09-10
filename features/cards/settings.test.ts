import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CARDS_SETTINGS,
  cardsSettingsFromProfileSettings,
  resolveCardsSettings,
  withCardsSettings,
} from './settings';

describe('resolveCardsSettings', () => {
  it('returns the defaults for undefined, null and garbage input', () => {
    expect(resolveCardsSettings(undefined)).toEqual(DEFAULT_CARDS_SETTINGS);
    expect(resolveCardsSettings(null)).toEqual(DEFAULT_CARDS_SETTINGS);
    expect(resolveCardsSettings('nope')).toEqual(DEFAULT_CARDS_SETTINGS);
    expect(resolveCardsSettings([1, 2])).toEqual(DEFAULT_CARDS_SETTINGS);
  });

  it('keeps valid values and fills missing branches', () => {
    const s = resolveCardsSettings({
      theme: { accent: '#0096ff' },
      session: { timeBudgetMin: 40, order: 'mixed' },
    });
    expect(s.theme.accent).toBe('#0096ff');
    expect(s.theme.mode).toBe('dark');
    expect(s.session.timeBudgetMin).toBe(40);
    expect(s.session.order).toBe('mixed');
    expect(s.session.deckOrder).toBe('interleaved');
    expect(s.typography).toEqual(DEFAULT_CARDS_SETTINGS.typography);
  });

  it('falls back on invalid enum values, colors and out-of-range numbers', () => {
    const s = resolveCardsSettings({
      theme: { accent: 'mint', mode: 'sepia' },
      interaction: { rating: 'five', autoAdvance: 1000, haptics: 'yes' },
      scheduler: { requestRetention: 1.5 },
    });
    expect(s.theme.accent).toBe(DEFAULT_CARDS_SETTINGS.theme.accent);
    expect(s.theme.mode).toBe('dark');
    expect(s.interaction.rating).toBe('four');
    expect(s.interaction.autoAdvance).toBe(300);
    expect(s.interaction.haptics).toBe(true);
    expect(s.scheduler.requestRetention).toBe(0.9);
  });

  it('accepts null as an explicit "off" for the break reminder', () => {
    expect(resolveCardsSettings({ session: { breakReminderMin: 20 } }).session.breakReminderMin).toBe(20);
    expect(resolveCardsSettings({ session: { breakReminderMin: null } }).session.breakReminderMin).toBeNull();
  });

  it('drops unknown keys and unknown widgets, de-duplicating the widget list', () => {
    const s = resolveCardsSettings({
      dashboard: { widgets: ['heatmap', 'queue', 'confetti', 'heatmap'] },
      somethingElse: true,
    });
    expect(s.dashboard.widgets).toEqual(['heatmap', 'queue']);
    expect('somethingElse' in s).toBe(false);
  });

  it('parses presets and only activates one that exists', () => {
    const s = resolveCardsSettings({
      presets: { bahn: { interaction: { rating: 'two' } }, '': { theme: {} } },
      activePreset: 'bahn',
    });
    expect(Object.keys(s.presets)).toEqual(['bahn']);
    expect(s.presets.bahn.interaction.rating).toBe('two');
    expect(s.presets.bahn.theme).toEqual(DEFAULT_CARDS_SETTINGS.theme);
    expect(s.activePreset).toBe('bahn');
    expect(resolveCardsSettings({ activePreset: 'ghost' }).activePreset).toBeNull();
  });
});

describe('profiles.settings integration', () => {
  it('reads the cards subtree from the whole settings object', () => {
    const s = cardsSettingsFromProfileSettings({ cards: { typography: { size: 'XL' } }, other: 1 });
    expect(s.typography.size).toBe('XL');
    expect(cardsSettingsFromProfileSettings({})).toEqual(DEFAULT_CARDS_SETTINGS);
  });

  it('replaces only the cards subtree and preserves other modules', () => {
    const next = withCardsSettings({ other: { a: 1 }, cards: { old: true } }, DEFAULT_CARDS_SETTINGS);
    expect(next.other).toEqual({ a: 1 });
    expect(next.cards).toEqual(DEFAULT_CARDS_SETTINGS);
    expect(withCardsSettings(null, DEFAULT_CARDS_SETTINGS)).toEqual({ cards: DEFAULT_CARDS_SETTINGS });
  });
});
