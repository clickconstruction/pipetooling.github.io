import type { ReactNode } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { boardSectionElementId, type BoardSection } from '../../lib/gcMode/gcModel'
import type { Tone } from './gcUi'

/**
 * GC mode design spike: the board's stages, easy to find and to jump to (the owner, 2026-10-04:
 * "just like on jobs stages I would like to see a header and these stages better broken down with
 * more clear headers"). The strip at the top has a pill per section, numbered 1, 2, 3 for the three
 * stages, and stays in sight as the board scrolls; each section opens on a heading with a bar in
 * its stage's color, its number, its count and what it is worth.
 */

/** One pill on the strip: a stage on By stage, a customer on By customer (the owner, 2026-10-04). */
export interface BoardStripItem {
  key: string
  label: string
  /** 1, 2, 3 for the three stages; none for Closed, Lost and customers. */
  number?: number
  tone: Tone
  count: number
  /** A customer's pill: a dot in each stage's color it has jobs in. */
  dots?: Tone[]
}

export interface StageStripItem extends BoardStripItem {
  key: BoardSection
}

/** A stage's colors: the bar, and its number's badge. The same family as the board's rings. */
const STAGE_COLORS: Record<Tone, { bar: string; bg: string; fg: string }> = {
  amber: { bar: 'var(--text-amber-700)', bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' },
  blue: { bar: 'var(--text-blue-500)', bg: 'var(--bg-blue-200)', fg: 'var(--text-blue-800)' },
  green: { bar: 'var(--text-green-600)', bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' },
  grey: { bar: 'var(--border-strong)', bg: 'var(--bg-muted)', fg: 'var(--text-600)' },
  red: { bar: 'var(--text-red-700)', bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' },
  violet: { bar: 'var(--text-violet-700)', bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-800)' },
}

function NumberBadge({ n, tone, size }: { n: number; tone: Tone; size: number }) {
  const c = STAGE_COLORS[tone]
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c.bar,
        color: 'var(--surface)',
        fontSize: size * 0.55,
        fontWeight: 700,
        flex: 'none',
      }}
    >
      {n}
    </span>
  )
}

/** The pills at the top of the board. Pressing one jumps to its section; the one in view is lit. */
export function GcBoardStrip({
  items,
  active,
  onJump,
  label,
  lead,
  trail,
}: {
  items: BoardStripItem[]
  active: string | null
  onJump: (key: string) => void
  /** What the strip jumps to: "Jump to a stage", "Jump to a customer". */
  label: string
  /** Before the pills: the By stage | By customer switch. */
  lead?: ReactNode
  /** After them, at the right: + New project on By customer. */
  trail?: ReactNode
}) {
  const narrow = useMatchMedia('(max-width: 640px)')
  return (
    <nav
      aria-label={label}
      data-tour="gc-stage-strip"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 6,
        background: 'var(--bg-page)',
        padding: '0.45rem 0',
        margin: '-0.45rem 0',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.4rem 0.5rem',
        minWidth: 0,
      }}
    >
      {lead}
      {/* On a phone the pills take a row of their own, under the switch and the button. */}
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', overflowX: 'auto', minWidth: 0, flex: narrow ? '1 1 100%' : '1 1 auto', order: narrow ? 2 : 0, paddingBottom: 1 }}>
        {items.map((item, i) => {
          const on = item.key === active
          const c = STAGE_COLORS[item.tone]
          const quiet = item.count === 0
          return (
            <span key={item.key} style={{ display: 'contents' }}>
              {i > 0 && (
                <span aria-hidden style={{ color: 'var(--text-faint)', userSelect: 'none', flex: 'none' }}>
                  {item.number ? '→' : '·'}
                </span>
              )}
              <button
                type="button"
                onClick={() => onJump(item.key)}
                aria-current={on ? 'true' : undefined}
                aria-label={`Jump to ${item.label}, ${item.count} ${item.count === 1 ? 'job' : 'jobs'}`}
                data-tour={`gc-jump-${item.key}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flex: 'none',
                  padding: '0.25rem 0.7rem 0.25rem 0.3rem',
                  borderRadius: 999,
                  border: `1px solid ${on ? c.bar : 'var(--border-strong)'}`,
                  background: on ? c.bg : 'var(--surface)',
                  color: on ? c.fg : quiet ? 'var(--text-muted)' : 'var(--text-base)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  paddingLeft: item.number ? '0.3rem' : '0.7rem',
                }}
              >
                {item.number ? <NumberBadge n={item.number} tone={item.tone} size={20} /> : null}
                {item.label}
                {item.dots && item.dots.length > 0 && (
                  <span aria-hidden style={{ display: 'inline-flex', gap: 3 }}>
                    {item.dots.map((t) => (
                      <span key={t} style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[t].bar }} />
                    ))}
                  </span>
                )}
                <span style={{ fontVariantNumeric: 'tabular-nums', color: on ? c.fg : 'var(--text-muted)', fontWeight: 700 }}>{item.count}</span>
              </button>
            </span>
          )
        })}
      </div>
      {trail && <span style={{ flex: 'none', marginLeft: 'auto', order: narrow ? 1 : 0 }}>{trail}</span>}
    </nav>
  )
}

/** A section's heading: its stage's color bar, number, name, count and worth, with what it is for under it. */
export function GcStageHeading({
  item,
  worth,
  blurb,
  titleTour,
  right,
}: {
  item: StageStripItem
  /** "$977,823 priced so far". */
  worth: string
  blurb: string
  /** New here?'s first stop numbers the three titles: its anchor stays on the title. */
  titleTour?: string
  right?: ReactNode
}) {
  const c = STAGE_COLORS[item.tone]
  return (
    <div
      id={boardSectionElementId(item.key)}
      style={{
        // Clears the sticky strip when the strip jumps here.
        scrollMarginTop: '3.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem 0.75rem',
        flexWrap: 'wrap',
        padding: '0.55rem 0.75rem',
        marginBottom: '0.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `5px solid ${c.bar}`,
        borderRadius: 8,
      }}
    >
      {item.number ? <NumberBadge n={item.number} tone={item.tone} size={26} /> : null}
      <div style={{ display: 'grid', gap: '0.05rem', minWidth: 0, flex: '1 1 16rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem 0.6rem', flexWrap: 'wrap' }}>
          <h3 data-tour={titleTour} style={{ margin: 0, fontSize: '1.1rem' }}>
            {item.label}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({item.count})</span>
          </h3>
          {worth && <span style={{ color: c.fg, fontWeight: 600, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>{worth}</span>}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{blurb}</span>
      </div>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  )
}

/** Inside a customer's section on By customer: a small heading for each stage they have jobs in. */
export function GcStageSubheading({ item }: { item: StageStripItem }) {
  const c = STAGE_COLORS[item.tone]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: c.fg, margin: '0.15rem 0 -0.15rem' }}>
      {item.number ? <NumberBadge n={item.number} tone={item.tone} size={18} /> : null}
      {item.label}
      <span style={{ color: 'var(--text-muted)' }}>({item.count})</span>
    </div>
  )
}

/** A customer's heading on By customer: the same band as a stage's, with their name, kind, contact and money. */
export function GcCustomerHeading({
  id,
  name,
  title,
  onName,
  count,
  sub,
  money,
}: {
  id: string
  name: string
  title: string
  onName: () => void
  count: number
  /** "Developer · Elena Marchetti". */
  sub: string
  /** "bidding $977,823 · under contract $1,488,762 · owes us $288,879". */
  money: string
}) {
  return (
    <div
      id={id}
      style={{
        scrollMarginTop: '3.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem 0.75rem',
        flexWrap: 'wrap',
        padding: '0.55rem 0.75rem',
        marginBottom: '0.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: '5px solid var(--text-blue-500)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'grid', gap: '0.05rem', minWidth: 0, flex: '1 1 16rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
          <button
            type="button"
            onClick={onName}
            title={title}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border-blue)', textUnderlineOffset: 3 }}
          >
            {name}
          </button>{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({count})</span>
        </h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sub}</span>
      </div>
      {money && <span style={{ marginLeft: 'auto', color: 'var(--text-600)', fontSize: '0.88rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money}</span>}
    </div>
  )
}
