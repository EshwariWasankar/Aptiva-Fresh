'use client';

import { useMemo } from 'react';

const SECTION_LABELS: Record<string, string> = {
  quant: 'Quant',
  reasoning: 'Logical',
  di: 'DI',
  verbal: 'Verbal',
};

interface Props {
  /** Mean rating per section (0–2000 scale), keyed by section slug. */
  values: Record<string, number>;
}

/** P-10 ProfileRadar — SVG radar chart, one axis per section. */
export function ProfileRadar({ values }: Props) {
  const sections = useMemo(() => Object.keys(values).sort(), [values]);
  if (sections.length === 0) return null;

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = 95;
  const n = sections.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, v: number) => {
    const r = (Math.min(Math.max(v, 800), 2200) - 800) / 1400; // map 800–2200 → 0–1
    return [cx + R * r * Math.cos(angle(i)), cy + R * r * Math.sin(angle(i))] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    sections
      .map((_, i) => {
        const [x, y] = point(i, 800 + f * 1400);
        return `${x},${y}`;
      })
      .join(' '),
  );
  const poly = sections.map((_, i) => point(i, values[sections[i]!] ?? 1500).join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto max-w-xs"
      role="img"
      aria-label="Ability radar by section"
    >
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#d4d4d4" strokeWidth="1" />
      ))}
      {sections.map((s, i) => {
        const [x, y] = point(i, 2200);
        return (
          <g key={s}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e5e5" />
            <text
              x={cx + (R + 18) * Math.cos(angle(i))}
              y={cy + (R + 18) * Math.sin(angle(i)) + 4}
              textAnchor="middle"
              fontSize="11"
              fill="#404040"
            >
              {SECTION_LABELS[s] ?? s}
            </text>
          </g>
        );
      })}
      <polygon points={poly} fill="rgba(55, 48, 163, 0.16)" stroke="#3730a3" strokeWidth="2.2" />
      {sections.map((s, i) => {
        const [x, y] = point(i, values[s] ?? 1500);
        return (
          <circle key={s} cx={x} cy={y} r="3.5" fill="#3730a3" stroke="#ffffff" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}
