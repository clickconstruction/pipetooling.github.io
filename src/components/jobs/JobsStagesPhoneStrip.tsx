import { useEffect, useState, type CSSProperties } from 'react'
import type { PhoneRowFilter } from '../../lib/jobs/jobNextLine'

export type PhoneStageKey = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

export const PHONE_STAGE_ORDER: PhoneStageKey[] = ['waiting', 'working', 'readyToBill', 'billed', 'collections']

const STAGE_LABEL: Record<PhoneStageKey, string> = {
  waiting: 'Waiting',
  working: 'Working',
  readyToBill: 'Ready',
  billed: 'Billed',
  collections: 'Coll.',
}

const chipBase: CSSProperties = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-strong)',
  borderRadius: 999,
  padding: '0.3rem 0.65rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  lineHeight: 1.1,
  flexShrink: 0,
}
const chipOn: CSSProperties = { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderColor: 'var(--border-blue)' }

/** The height of the page's own sticky tab strip above us, so the two stack instead of overlapping. */
function useStickyTop(): number {
  const [top, setTop] = useState(0)
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector('[data-jobs-page-tabs]') as HTMLElement | null
      setTop(el ? Math.round(el.getBoundingClientRect().height) : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return top
}

/**
 * The phone Pipeline's head (punch list #30, PR 2a): the jump strip as sticky stage chips —
 * one stage shows at a time — and the All / Needs me / Today row under it.
 */
export function JobsStagesPhoneStrip({
  counts,
  active,
  onPick,
  filter,
  onFilter,
  filterCounts,
  stageLine,
}: {
  counts: Record<PhoneStageKey, string>
  active: PhoneStageKey
  onPick: (key: PhoneStageKey) => void
  filter: PhoneRowFilter
  onFilter: (f: PhoneRowFilter) => void
  filterCounts: { all: number; needs: number; today: number }
  /** "Working · $393.4k · $42,334 capable of billing" */
  stageLine: string | null
}) {
  const top = useStickyTop()
  return (
    <div
      data-stages-phone-strip
      style={{ position: 'sticky', top, zIndex: 19, background: 'var(--surface)', margin: '0 -0.25rem', padding: '0.35rem 0.25rem 0.4rem', borderBottom: '1px solid var(--border)' }}
    >
      <div role="tablist" aria-label="Pipeline stages" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {PHONE_STAGE_ORDER.map((key) => {
          const on = key === active
          const isColl = key === 'collections'
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onPick(key)}
              style={{
                ...chipBase,
                ...(on ? chipOn : null),
                ...(!on && isColl && counts.collections !== '0' && counts.collections !== '…' ? { color: 'var(--text-red-700)', borderColor: 'var(--border-red)' } : null),
              }}
            >
              {STAGE_LABEL[key]} {counts[key]}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem' }}>
        {(
          [
            ['all', `All ${filterCounts.all}`],
            ['needs', `Needs me ${filterCounts.needs}`],
            ['today', `Today ${filterCounts.today}`],
          ] as Array<[PhoneRowFilter, string]>
        ).map(([key, label]) => {
          const on = filter === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onFilter(key)}
              style={{
                ...chipBase,
                fontSize: '0.75rem',
                padding: '0.25rem 0.55rem',
                ...(on ? chipOn : null),
                ...(!on && key === 'needs' && filterCounts.needs > 0 ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' } : null),
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      {stageLine ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stageLine}</div> : null}
    </div>
  )
}
