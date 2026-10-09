/**
 * GC mode, the real build, the schedule's PR 7c-ii: by company as a call list (G-115) over the Schedule window's chart, and the
 * opened bar's company. Moved word for word from the GC mode prototype (branch spike/gc-mode, `GcCallList.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7c.md on that branch. One known difference: `onFollowUp` and `onWorkList` are optional.
 * Unset, Call only dials, and neither Follow up nor Work the list is drawn, until the Board lane lifts the Follow up sheet.
 */
import { useState } from 'react'
import { telHref } from '../../lib/gc/followUpSheet'
import type { ProjectPerson } from '../../lib/gc/projectPeople'
import { callListTitle, type BarCaller, type CallList } from '../../lib/gc/schedule/callList'
import { PeopleRows } from './GcPeopleRows'
import { Btn } from './gcUi'

/**
 * GC mode design spike: By company as a call list (the Gantt's G-115; mock-up
 * `to-dos/gc-mode/mockups/G-115.md`). Under the chart's toolbar while it is grouped by company:
 * everyone whose answer moves the chart, late first, with every reason under the name. The rows
 * are Follow up's own (`PeopleRows`), so Call dials and opens the Follow up sheet on "What did they
 * say?", and Follow up opens it on a draft. A line about a bar opens that bar. Kernel: gcCallList.ts.
 */
export function GcCallList({
  list,
  onFollowUp,
  onWorkList,
  onReason,
  theirWork,
}: {
  list: CallList
  /** The Follow up sheet on this list, at this person: on "What did they say?" after a Call. Unset: Call only dials. */
  onFollowUp?: (person: ProjectPerson, calling: boolean) => void
  /** The Follow up sheet on this list, from the first. Unset: no Work the list. */
  onWorkList?: () => void
  /** A line about a bar was pressed: open the bar. */
  onReason: (lineId: string) => void
  /** The chart's one company (G-13): a press that shows a person's company's work, or null when the chart has none of theirs. */
  theirWork?: (person: ProjectPerson) => (() => void) | null
}) {
  const [hidden, setHidden] = useState(false)
  // A phone puts each person's buttons under their words. Read once: a test page may have no matchMedia.
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 480px)').matches
  const box = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' } as const

  if (list.count === 0) {
    return (
      <div data-tour="gc-call-list" style={{ ...box, color: 'var(--text-muted)' }}>
        <span aria-hidden style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>✓ </span>
        {callListTitle(list)}
      </div>
    )
  }
  return (
    <section data-tour="gc-call-list" aria-label="Who to call about the schedule" style={{ ...box, display: 'grid', gap: '0.15rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.92rem' }}>{callListTitle(list)}</strong>
        {list.late > 0 && <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>· {list.late} late</span>}
        <span style={{ flex: 1 }} />
        {!hidden && onWorkList && (
          <Btn kind="primary" onClick={onWorkList} title="The Follow up sheet, one person at a time, down this list">
            Work the list
          </Btn>
        )}
        <Btn kind="quiet" onClick={() => setHidden((h) => !h)} title={hidden ? 'Show who to call' : 'Fold the list to this line'}>
          {hidden ? 'Show' : 'Hide'}
        </Btn>
      </div>
      {!hidden && (
        <>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Late first. One call covers every reason under a name. Press a line about a bar to open it.</span>
          <div style={{ display: 'grid', fontSize: '0.82rem', lineHeight: 1.35 }}>
            <PeopleRows
              people={list.people}
              narrow={phone}
              {...(onFollowUp ? { onFollowUp } : {})}
              onReason={(_, r) => {
                if (r.lineId) onReason(r.lineId)
              }}
              {...(theirWork ? { theirWork } : {})}
            />
          </div>
        </>
      )}
    </section>
  )
}

/**
 * The opened bar's company (G-115, the mock-up's picture 2: "chase the company" from the opened
 * activity): who does it, their word on its newest dates, and Call and Follow up.
 */
export function GcBarCaller({ caller, onFollowUp }: { caller: BarCaller; onFollowUp?: (calling: boolean) => void }) {
  return (
    <div data-tour="gc-bar-caller" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>
        <strong>{caller.partner.company}</strong> <span style={{ color: 'var(--text-muted)' }}>· {caller.name}</span>
      </span>
      {caller.word && <span style={{ color: 'var(--text-muted)' }}>{caller.word}</span>}
      <span style={{ flex: 1 }} />
      {/* One click to call (the owner, 2026-10-04): it dials, then the sheet asks what they said. */}
      <a
        href={telHref(caller.phone)}
        title={`Call ${caller.name}, ${caller.phone}`}
        onClick={() => onFollowUp?.(true)}
        style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
      >
        Call {caller.first}
      </a>
      {onFollowUp && (
        <Btn kind="primary" onClick={() => onFollowUp(false)} title="A text or an email from you, drafted, about this bar and everything else on the call list">
          Follow up
        </Btn>
      )}
    </div>
  )
}
