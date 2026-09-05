/**
 * The sheet rail, drawn (Work Orders one-row spine, PR 2): seven dots on one
 * line — three small office dots, four big sub dots — with the current dot in
 * terracotta and a dashed red run where work is happening with nothing
 * signed. Both tabs and the small chips elsewhere draw from this one
 * component so office and sub read the same picture. Pure presentation; the
 * shape comes from `buildSheetRail`.
 */
import type { CSSProperties } from 'react'
import type { SheetRail as SheetRailShape, SheetRailStep } from '../../lib/subWorkOrders/sheetRail'

import { SHEET_RAIL_GAP, SHEET_RAIL_NOW, SHEET_RAIL_NOW_HALO, sheetRailLabelColor } from '../../lib/subWorkOrders/sheetRailTone'

export type SheetRailProps = {
  rail: SheetRailShape
  /** Label + sublabel to the right of the dots (default true). */
  showLabel?: boolean
  /** Smaller dots and gaps for cards and chips. */
  compact?: boolean
  /** Sits on the current dot — the stage menu door on Sub Labor (PR 4). */
  onCurrentClick?: () => void
  /** The rest of the rail opens the sheet's story (PR 6). */
  onClick?: () => void
  title?: string
}

const isOffice = (s: SheetRailStep) => s.key === 'drafted' || s.key === 'sent' || s.key === 'signed'

export function SheetRail({ rail, showLabel = true, compact = false, onCurrentClick, onClick, title }: SheetRailProps) {
  const big = compact ? 8 : 10
  const small = compact ? 6 : 8
  const nowSize = compact ? 11 : 14
  const seg = compact ? 10 : 16
  const bridge = compact ? 7 : 10

  const dot = (s: SheetRailStep, i: number) => {
    const office = isOffice(s)
    const base = office ? small : big
    const size = s.state === 'now' ? nowSize : base
    const style: CSSProperties = {
      width: size,
      height: size,
      borderRadius: '50%',
      flex: 'none',
      boxSizing: 'border-box',
      border: `2px solid var(--border-strong)`,
      background: 'var(--surface)',
    }
    if (s.state === 'done') {
      style.background = 'var(--text-faint)'
      style.borderColor = 'var(--text-faint)'
    } else if (s.state === 'gap') {
      style.borderColor = SHEET_RAIL_GAP
      style.borderStyle = 'dashed'
      style.background = 'transparent'
    }
    if (s.state === 'now' || (s.key === 'paid' && rail.current === 'paid')) {
      style.background = rail.current === 'paid' && s.key === 'paid' ? 'var(--text-green-700)' : SHEET_RAIL_NOW
      style.borderColor = style.background
      style.boxShadow = `0 0 0 3px ${rail.current === 'paid' && s.key === 'paid' ? 'var(--bg-green-tint)' : SHEET_RAIL_NOW_HALO}`
      style.width = nowSize
      style.height = nowSize
    }
    const isCurrent = s.key === rail.current
    const el = isCurrent && onCurrentClick ? (
      <button
        key={s.key}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onCurrentClick()
        }}
        aria-label={`${s.label} — change stage`}
        style={{ ...style, padding: 0, cursor: 'pointer' }}
      />
    ) : (
      <span key={s.key} style={style} aria-hidden="true" />
    )
    if (i === rail.steps.length - 1) return el
    const next = rail.steps[i + 1]
    const lineDone = s.state === 'done' && (next?.state === 'done' || next?.state === 'now')
    const lineGap = s.state === 'gap' && (next?.state === 'gap' || next?.state === 'now')
    const lineStyle: CSSProperties = {
      width: s.key === 'signed' ? bridge : seg,
      height: 2,
      flex: 'none',
      background: lineDone ? 'var(--text-faint)' : lineGap ? `repeating-linear-gradient(90deg, ${SHEET_RAIL_GAP} 0 3px, transparent 3px 6px)` : 'var(--border-strong)',
    }
    return [el, <span key={`${s.key}-l`} style={lineStyle} aria-hidden="true" />]
  }

  const accessible = `${rail.label}${rail.sublabel ? ` — ${rail.sublabel}` : ''}`
  const tooltip = title ?? rail.steps.map((s) => `${s.label}: ${s.state === 'now' ? 'here' : s.state === 'gap' ? 'nothing signed' : s.state}`).join(' · ')
  const doorProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `${accessible} — open the sheet's story`,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        },
      }
    : { role: 'img' as const, 'aria-label': accessible }
  return (
    <span
      {...doorProps}
      title={onClick ? `${tooltip} · click for the sheet's story` : tooltip}
      style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', cursor: onClick ? 'pointer' : undefined, borderRadius: 6 }}
    >
      {rail.steps.flatMap(dot)}
      {showLabel ? (
        <span style={{ marginLeft: 8, fontSize: compact ? '0.72rem' : '0.75rem', fontWeight: 700, color: sheetRailLabelColor(rail.tone), lineHeight: 1.2 }}>
          {rail.label}
          {rail.sublabel ? <span style={{ display: 'block', fontWeight: 500, color: 'var(--text-muted)', fontSize: compact ? '0.66rem' : '0.69rem' }}>{rail.sublabel}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
