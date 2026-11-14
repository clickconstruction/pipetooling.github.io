import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { loadPayerPayCalendars } from '../../lib/jobs/payCalendarIo'
import { JOB_NO_CALENDAR_WORDS, payCalendarShort, payCalendarWords } from '../../lib/jobs/payCalendar'
import { draftPayTermsFromWords, draftPayTermsScopeWords, newJobPayTermsTail, type DraftPayTerms, type NewJobPayTermsState } from '../../lib/jobs/draftPayTerms'

/**
 * New Job's line for the pay terms an estimator's draft carried (punch list #323, the owner's
 * call of 2026-11-13): *Pay terms from Dana Whitfield's draft: In by the 25th, paid the 10th ·
 * only this job · Check and use*. The press opens the Pay calendar window filled in, with the
 * payer's record in front of the office. Agreed for every job the payer pays, the window saves
 * it there and then. Agreed for this job alone, nothing is written yet: the job does not exist,
 * so the line reads *sets with the job* and Create Job sets it. A line of small words, never a
 * field, and nothing the office must answer before it creates the job.
 *
 * For the roles that set a calendar. Without a payer the line says so and offers no press.
 */
const pressStyle = { fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

export default function NewJobPayTermsLine({
  terms,
  from,
  payer,
  jobLabel,
  state,
  onState,
  zIndex,
}: {
  terms: DraftPayTerms
  /** Who sent the draft, for the words. */
  from: string | null
  /** Who the new job's bills go to, by the form as it stands; null while it names nobody. */
  payer: { id: string; name: string } | null
  /** The job in a few words, for the window's *Only …* choice. */
  jobLabel: string
  state: NewJobPayTermsState
  onState: (next: NewJobPayTermsState) => void
  zIndex?: number
}) {
  const role = useOptionalAuth()?.role ?? null
  const opener = usePayCalendarModal()
  if (!opener || !isStagesOfficeRole(role)) return null

  const held = state.kind === 'with-job' ? state.calendar : null
  const heldOff = held != null && 'off' in held
  const shown = held && !('off' in held) ? held : terms.calendar
  const tail = newJobPayTermsTail(state, payer?.name)

  const open = () => {
    if (!payer) return
    opener.openPayCalendar(payer, {
      zIndex,
      // What the office already agreed for this job opens again as they left it.
      initial: { calendar: shown, scope: held ? 'job' : terms.scope, from: draftPayTermsFromWords(from) },
      jobToBe: { label: jobLabel, onUse: (calendar) => onState(calendar ? { kind: 'with-job', calendar } : { kind: 'offered' }) },
      // A save here was for the payer. Read it back, so the line says what is stored and not what was pressed.
      onSaved: () => {
        void loadPayerPayCalendars(supabase, payer.id).then(
          (rows) => onState(rows.some((r) => r.jobId == null && r.calendar) ? { kind: 'payer-saved' } : { kind: 'offered' }),
          () => {},
        )
      },
    })
  }

  return (
    <div data-testid="new-job-pay-terms" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline', fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.15rem 0' }}>
      <span>Pay terms from {draftPayTermsFromWords(from).replace(/^The draft$/, 'the draft')}:</span>
      <strong style={{ color: 'var(--text-base)', fontWeight: 600 }} title={heldOff ? undefined : payCalendarWords(shown)}>
        {heldOff ? JOB_NO_CALENDAR_WORDS : payCalendarShort(shown)}
      </strong>
      <span data-testid="new-job-pay-terms-tail">{tail ?? draftPayTermsScopeWords(terms.scope)}</span>
      {state.kind === 'payer-saved' ? null : payer ? (
        <button type="button" onClick={open} style={pressStyle} title={`Opens ${payer.name}’s pay calendar filled in, with their record against it`}>
          {state.kind === 'with-job' ? 'Change' : 'Check and use'}
        </button>
      ) : (
        <span>Pick who the bills go to, then check them.</span>
      )}
    </div>
  )
}
