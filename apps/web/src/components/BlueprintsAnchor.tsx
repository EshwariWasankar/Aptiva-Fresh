'use client';

import type { ReactNode } from 'react';

/**
 * Anchor that scrolls to #blueprints without pushing a history entry.
 * Plain href="#blueprints" anchors create hash history entries that break
 * Next.js back/forward restoration (URL changes but the previous page
 * keeps rendering). scrollIntoView + no push keeps history clean.
 */
export function BlueprintsAnchor({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href="#blueprints"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('blueprints')?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {children}
    </a>
  );
}
