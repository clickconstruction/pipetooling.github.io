/**
 * One entry for a submittal approved whole (Submittals stage 5b): the GC or the architect
 * said yes to all of it by email, on paper or before the room existed, and the office
 * records it once. Every row with no call yet reads Approved, in that reviewer's name, on
 * the day they said it; a row that already carries a call keeps it. Save hands the choice
 * to the tab, which writes the rows. The window is held to the screen's height: the title
 * and the buttons are pinned and the fields between them scroll.
 */
import { useState, type CSSProperties } from 'react'

import { ENTERED_ON_MIN, enteredOnProblem } from '../../lib/submittals/enteredDecisions'
import { initialReviewerPick, reviewerChoiceFrom, reviewerPickBad, type ReviewerChoice, type ReviewerPick } from '../../lib/submittals/reviewerPick'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { SubmittalReviewerPicker } from './SubmittalReviewerPicker'

export type ApproveAllChoice = {
  person: ReviewerChoice
  note: string
  /** The day of their approval (YYYY-MM-DD) when it is not today. */
  on?: string
}

const Z = 10060
const fieldLabel: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

export function SubmittalApproveAllDialog({ revLabel, rows, alreadyDecided, missing, people = [], busy = false, onSave, onClose }: {
  /** "Rev 1" */
  revLabel: string
  /** Rows the entry will mark Approved (`rowsToApproveAll`). */
  rows: number
  /** Rows that already carry a call and keep it. */
  alreadyDecided: number
  /** Rows with no product, left out. */
  missing: number
  people?: ReadonlyArray<SubmittalPersonRow>
  busy?: boolean
  onSave: (choice: ApproveAllChoice) => void
  onClose: () => void
}) {
  const today = todayYmdInAppTz()
  const [pick, setPick] = useState<ReviewerPick>(() => initialReviewerPick(people))
  const [on, setOn] = useState(today)
  const [note, setNote] = useState('')
  const pickBad = reviewerPickBad(pick)
  const onProblem = enteredOnProblem(on, today)
  const bad = rows === 0 || pickBad || onProblem != null
  const kept = [alreadyDecided > 0 ? `${alreadyDecided} ${alreadyDecided === 1 ? 'row already has a call and keeps it' : 'rows already have a call and keep it'}` : '', missing > 0 ? `${missing} ${missing === 1 ? 'row has no product and is left out' : 'rows have no product and are left out'}` : ''].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`They approved ${revLabel}`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', maxHeight: '100%', minHeight: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>They approved {revLabel}</h3>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="approve-all-scope">
            This marks {rows} {rows === 1 ? 'row' : 'rows'} Approved in one entry.{kept.length > 0 ? ` ${kept.join('. ')}.` : ''}
          </p>
        </div>

        {/* The fields scroll; the title above and the buttons below hold still. */}
        <div data-testid="approve-all-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', margin: '0 -1.25rem', padding: '0.15rem 1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>Who approved it</span>
          <SubmittalReviewerPicker people={people} value={pick} onChange={setPick} />
          {pickBad ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>A name and an email, so the record says whose call it is.</span> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={fieldLabel}>Approved on</span>
            <input type="date" aria-label="Approved on" value={on} min={ENTERED_ON_MIN} max={today} onChange={(e) => setOn(e.target.value)} style={{ ...inputStyle, borderColor: onProblem ? '#dc2626' : 'var(--border-strong)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 200 }}>
            <span style={fieldLabel}>Their note · optional</span>
            <input type="text" aria-label="Their note" placeholder="approved as submitted" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} style={inputStyle} />
          </label>
        </div>
        {onProblem ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>{onProblem}</span> : null}
        <span style={smallMuted}>The day you pick is the Released date on the procurement log. Each row reads entered by you. To take one back, tap Edit on the row and clear it.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={bad || busy}
            data-testid="approve-all-save"
            onClick={() => onSave({ person: reviewerChoiceFrom(pick), note, ...(on && on !== today ? { on } : {}) })}
            style={{ padding: '0.45rem 0.9rem', background: bad || busy ? 'var(--bg-200)' : '#16a34a', color: bad || busy ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: bad || busy ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
          >
            Approve {rows} {rows === 1 ? 'row' : 'rows'}
          </button>
        </div>
      </div>
    </div>
  )
}
