// Which top-level modules a user sees. Stored in profiles.settings.modules,
// next to the cards module's own `cards` subtree. The cards module is always
// on; the fitness module (home, food, workout, analytics, budget) is hidden
// by default and can be re-enabled per user under /cards/settings.

export interface ModulesSettings {
  fitness: boolean;
}

export const DEFAULT_MODULES: ModulesSettings = { fitness: false };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Read `modules` out of a whole profiles.settings object. Never throws. */
export function resolveModules(profileSettings: unknown): ModulesSettings {
  const modules = isRecord(profileSettings) && isRecord(profileSettings.modules) ? profileSettings.modules : {};
  return {
    fitness: typeof modules.fitness === 'boolean' ? modules.fitness : DEFAULT_MODULES.fitness,
  };
}

/** New profiles.settings value with only the `modules` subtree replaced. */
export function withModules(profileSettings: unknown, modules: ModulesSettings): Record<string, unknown> {
  const existing = isRecord(profileSettings) ? profileSettings : {};
  return { ...existing, modules };
}
