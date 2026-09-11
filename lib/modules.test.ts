import { describe, it, expect } from 'vitest';
import { DEFAULT_MODULES, resolveModules, withModules } from './modules';

describe('resolveModules', () => {
  it('defaults to fitness off', () => {
    expect(resolveModules(undefined)).toEqual(DEFAULT_MODULES);
    expect(resolveModules({})).toEqual({ fitness: false });
    expect(resolveModules({ modules: { fitness: 'yes' } })).toEqual({ fitness: false });
  });

  it('reads an explicit flag', () => {
    expect(resolveModules({ modules: { fitness: true } })).toEqual({ fitness: true });
    expect(resolveModules({ cards: {}, modules: { fitness: false } })).toEqual({ fitness: false });
  });
});

describe('withModules', () => {
  it('replaces only the modules subtree', () => {
    const next = withModules({ cards: { theme: {} }, modules: { fitness: false } }, { fitness: true });
    expect(next).toEqual({ cards: { theme: {} }, modules: { fitness: true } });
    expect(withModules(null, { fitness: true })).toEqual({ modules: { fitness: true } });
  });
});
