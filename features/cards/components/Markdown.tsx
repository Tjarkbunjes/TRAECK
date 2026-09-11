'use client';

import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { NORM_CLASS, remarkNormChips } from '../content/markdown';

type SpanProps = ComponentProps<'span'> & { node?: unknown };

function Span({ className, node: _node, ...props }: SpanProps) {
  void _node;
  const isNorm = typeof className === 'string' && className.split(' ').includes(NORM_CLASS);
  return (
    <span
      {...props}
      className={cn(
        isNorm && 'rounded bg-[var(--cards-accent)]/15 px-1 font-mono text-[0.85em] text-[var(--cards-accent)] whitespace-nowrap',
        !isNorm && className
      )}
    />
  );
}

const components = { span: Span };
const remarkPlugins = [remarkGfm, remarkNormChips];

interface MarkdownProps {
  children: string;
  className?: string;
}

/** GFM markdown with statute citations rendered as chips. */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'cards-prose text-[15px] leading-relaxed break-words',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
        '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-muted-foreground',
        '[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:rounded [&_code]:bg-muted [&_code]:px-1',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_table]:my-2 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/50 [&_td]:px-2 [&_td]:py-1',
        '[&_hr]:my-3 [&_hr]:border-border [&_a]:underline [&_strong]:font-semibold',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
