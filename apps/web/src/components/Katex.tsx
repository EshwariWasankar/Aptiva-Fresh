'use client';

import { useEffect, useState } from 'react';
import 'katex/dist/katex.min.css';

interface KatexApi {
  renderToString(tex: string, options?: { displayMode?: boolean; throwOnError?: boolean }): string;
}

/**
 * Renders question stems / lesson content: plain text plus $...$
 * (inline) and $$...$$ (display) LaTeX via KaTeX (P-21 preview, P-02).
 * KaTeX is lazy-imported so pages that never show math don't pay the
 * bundle cost. Input is expected to be already sanitised server-side.
 */
export function Katex({ text, className }: { text: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    void import('katex').then((mod) => {
      const api = (mod as { default?: KatexApi }).default ?? (mod as unknown as KatexApi);
      if (!dead) setHtml(renderMixed(text, api));
    });
    return () => {
      dead = true;
    };
  }, [text]);

  if (html === null) {
    return (
      <span
        className={`inline-block max-w-full break-words [overflow-wrap:anywhere] ${className ?? ''}`}
      >
        {text}
      </span>
    );
  }
  return (
    <span
      className={`inline-block max-w-full break-words [overflow-wrap:anywhere] ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMixed(input: string, katex: KatexApi): string {
  const parts = input.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const tex = part.slice(2, -2);
        try {
          const rendered = katex.renderToString(tex, { displayMode: true, throwOnError: false });
          return `<span class="block max-w-full overflow-x-auto my-1 py-0.5">${rendered}</span>`;
        } catch {
          return `<code>${escapeHtml(tex)}</code>`;
        }
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const tex = part.slice(1, -1);
        try {
          return katex.renderToString(tex, { displayMode: false, throwOnError: false });
        } catch {
          return `<code>${escapeHtml(tex)}</code>`;
        }
      }
      return escapeHtml(part).replace(/\n/g, '<br/>');
    })
    .join('');
}
