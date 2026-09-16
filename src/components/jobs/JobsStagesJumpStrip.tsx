/**
 * The Pipeline board's jump strip (Stages tab decomposition PR 4, v2.3534): Waiting →
 * Working → Ready to Bill → Billed Awaiting Payment (→ Collections while it has rows), each
 * a link that opens and scrolls to its section, with the section's count beside it.
 *
 * Lifted out of `JobsStagesTab.tsx` (region 3 of `docs/JOBS_STAGES_TAB_ARCHITECTURE.md`),
 * where it was five copies of the same markup. One table row per section renders the same
 * DOM the copies did — the aria-label's noun ("jobs" for the job-only sections, "rows" for
 * the mixed ones), the red Collections link, and the arrow between neighbours included. The
 * counts come in already resolved (`stagesJumpStripCount`: live, stats-spine or "…").
 */
import type { CSSProperties } from 'react'

export type JumpStripSection = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

export type JumpStripCounts = Record<JumpStripSection, string>

const SECTIONS: ReadonlyArray<{
  key: JumpStripSection
  label: string
  /** What the count counts, for the aria-label. */
  noun: 'jobs' | 'rows'
  color: string
  /** Collections only shows while it has something in it. */
  hideWhenZero?: true
}> = [
  { key: 'waiting', label: 'Waiting', noun: 'jobs', color: 'var(--text-blue-700)' },
  { key: 'working', label: 'Working', noun: 'jobs', color: 'var(--text-blue-700)' },
  { key: 'readyToBill', label: 'Ready to Bill', noun: 'rows', color: 'var(--text-blue-700)' },
  { key: 'billed', label: 'Billed Awaiting Payment', noun: 'rows', color: 'var(--text-blue-700)' },
  { key: 'collections', label: 'Collections', noun: 'rows', color: 'var(--text-red-700)', hideWhenZero: true },
]

const itemStyle: CSSProperties = { display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }
const arrowStyle: CSSProperties = { color: 'var(--text-faint)', userSelect: 'none' }

export function JobsStagesJumpStrip({
  counts,
  onFocusSection,
}: {
  counts: JumpStripCounts
  /** Opens the section and scrolls to its header (the tab's `focusStagesSection`). */
  onFocusSection: (section: JumpStripSection) => void
}) {
  const shown = SECTIONS.filter((s) => !(s.hideWhenZero && counts[s.key] === '0'))
  return (
    <>
      {shown.map((section, index) => (
        <span key={section.key} style={{ display: 'contents' }}>
          {index > 0 ? (
            <span style={arrowStyle} aria-hidden>
              →
            </span>
          ) : null}
          <span style={itemStyle}>
            <button
              type="button"
              onClick={() => onFocusSection(section.key)}
              aria-label={`Jump to ${section.label}, ${counts[section.key]} ${section.noun}`}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                font: 'inherit',
                color: section.color,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {section.label}
            </button>
            <span>({counts[section.key]})</span>
          </span>
        </span>
      ))}
    </>
  )
}
