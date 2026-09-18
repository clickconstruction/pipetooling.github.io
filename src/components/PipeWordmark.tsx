import type { CSSProperties } from 'react'

import { PIPE_ACCENT, buildPipeWord } from '../lib/pipeWordmark'

export type PipeWordmarkProps = {
  word: string
  className?: string
  style?: CSSProperties
  /** The handwheels' color; everything else is `currentColor`. */
  accent?: string
}

/**
 * A word drawn as letters made of pipe (v2.3583): the pipe and its flanges in `currentColor`,
 * the handwheels in the accent. The SVG is `role="img"` named by the word; when a character has
 * no glyph the word renders as plain text so nothing ever goes missing.
 */
export function PipeWordmark({ word, className, style, accent = PIPE_ACCENT }: PipeWordmarkProps) {
  const g = buildPipeWord(word)
  if (!g) return <>{word}</>
  const { viewBox: vb } = g
  return (
    <svg
      className={className}
      style={style}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      role="img"
      aria-label={word}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="pipe-wordmark"
    >
      <path d={g.path} fill="none" stroke="currentColor" strokeWidth={g.stroke} strokeLinecap="butt" strokeLinejoin="round" />
      {g.flanges.map((f, i) => (
        <rect
          key={`f${i}`}
          x={-f.thick / 2}
          y={-f.across / 2}
          width={f.thick}
          height={f.across}
          rx={2}
          fill="currentColor"
          transform={`translate(${f.cx} ${f.cy}) rotate(${f.angle})`}
        />
      ))}
      {g.wheels.map((w, i) => (
        <g key={`w${i}`} data-testid="pipe-wheel">
          <line x1={w.stem.x1} y1={w.stem.y1} x2={w.stem.x2} y2={w.stem.y2} stroke="currentColor" strokeWidth={w.stem.width} />
          <circle cx={w.cx} cy={w.cy} r={w.r} fill="none" stroke={accent} strokeWidth={w.ring} />
          <path d={`M${w.cx - w.r} ${w.cy}H${w.cx + w.r}M${w.cx} ${w.cy - w.r}V${w.cy + w.r}`} stroke={accent} strokeWidth={w.spoke} />
          <circle cx={w.cx} cy={w.cy} r={w.hub} fill={accent} />
        </g>
      ))}
    </svg>
  )
}

export default PipeWordmark
