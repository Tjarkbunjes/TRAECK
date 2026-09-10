import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../components/Markdown';
import { findNorms } from './markdown';

describe('norm citation regex', () => {
  it('recognises the common citation shapes', () => {
    expect(findNorms('Anspruch aus § 823 I BGB.')).toEqual(['§ 823 I BGB']);
    expect(findNorms('Art. 12 GG und Art. 12 I GG')).toEqual(['Art. 12 GG', 'Art. 12 I GG']);
    expect(findNorms('§§ 280 I, III, 281 BGB')).toEqual(['§§ 280 I, III, 281 BGB']);
    expect(findNorms('§ 24 I 1 Alt. 1 StGB')).toEqual(['§ 24 I 1 Alt. 1 StGB']);
    expect(findNorms('§ 249 ff. BGB; § 281 I 2, 3 BGB')).toEqual(['§ 249 ff. BGB', '§ 281 I 2, 3 BGB']);
    expect(findNorms('§ 42 II VwGO analog, § 113 I 1 VwGO')).toEqual(['§ 42 II VwGO', '§ 113 I 1 VwGO']);
  });

  it('ignores a paragraph sign followed by a normal word', () => {
    expect(findNorms('§ 5 Der Vertrag')).toEqual([]);
    expect(findNorms('ohne norm')).toEqual([]);
  });
});

describe('<Markdown>', () => {
  it('renders gfm and wraps citations in norm chips', () => {
    const html = renderToStaticMarkup(<Markdown>{'Prüfe **§ 823 I BGB** und\n\n| a | b |\n|---|---|\n| 1 | 2 |'}</Markdown>);
    expect(html).toContain('<strong>');
    expect(html).toContain('<table>');
    expect(html).toMatch(/<span class="[^"]*">§ 823 I BGB<\/span>/);
  });

  it('leaves citations inside code untouched', () => {
    const html = renderToStaticMarkup(<Markdown>{'`§ 823 I BGB`'}</Markdown>);
    expect(html).toContain('<code>§ 823 I BGB</code>');
    expect(html).not.toContain('<span');
  });
});
