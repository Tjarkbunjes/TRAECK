'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card, StreitstandFields } from '../types';
import { cardFaces } from '../model/variants';
import { Markdown } from './Markdown';

interface CardFaceProps {
  card: Card;
  variant: string;
  /** which side(s) to show; `both` is the editor preview */
  side: 'front' | 'back' | 'both';
  align?: 'center' | 'left';
  divider?: boolean;
  className?: string;
}

function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-lg border border-border" open={defaultOpen}>
      <summary className="flex min-h-[44px] cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" strokeWidth={1.5} />
        {title}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function StreitstandBack({ fields }: { fields: StreitstandFields }) {
  return (
    <div className="space-y-2 text-left">
      {fields.ansichten.map((a, i) => (
        <Section key={i} title={a.name || `ansicht ${i + 1}`}>
          <Markdown>{a.argumente.map((arg) => `- ${arg}`).join('\n')}</Markdown>
        </Section>
      ))}
      {fields.rechtsprechung.trim() && (
        <Section title="rechtsprechung">
          <Markdown>{fields.rechtsprechung}</Markdown>
        </Section>
      )}
      {fields.stellungnahme.trim() && (
        <Section title="stellungnahme">
          <Markdown>{fields.stellungnahme}</Markdown>
        </Section>
      )}
    </div>
  );
}

/** Renders one variant of a card. Layout options come from CardsSettings.layout. */
export function CardFace({ card, variant, side, align = 'center', divider = true, className }: CardFaceProps) {
  const faces = cardFaces(card, variant);
  const alignCls = align === 'center' ? 'text-center' : 'text-left';
  const showFront = side !== 'back';
  const showBack = side !== 'front';

  return (
    <div className={cn('space-y-4', alignCls, className)}>
      {showFront && <Markdown>{faces.front}</Markdown>}
      {showFront && showBack && divider && <hr className="border-border" />}
      {showBack && faces.kind === 'markdown' && (
        <>
          <Markdown>{faces.back}</Markdown>
          {faces.extra && (
            <div className="border-t border-border/60 pt-3">
              <Markdown className="text-sm text-muted-foreground">{faces.extra}</Markdown>
            </div>
          )}
        </>
      )}
      {showBack && faces.kind === 'streitstand' && <StreitstandBack fields={faces.fields} />}
    </div>
  );
}
