/**
 * A GC's proposal that waits on a paper a job requires (punch list #389, step 6), under the paper's row in the
 * office's section. It says who proposed and when, and each topic the proposal moves, from the job's choice to the
 * stricter one. Two presses answer it. **Take it** says first who signs again, and saves the proposed settings: in
 * place while nobody has signed, and as a new version once somebody has. **Decline…** asks for a reason the GC reads.
 *
 * The proposal changes no paper until it is taken. The database decides every rule (`jobPaperProposalsIo.ts`), and
 * `jobPaperProposal.ts` says them before the press.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { DECLINE_WORDS, decidedWords, proposalChanges, proposalHead, takeWords } from '../../lib/contracts/jobPaperProposal'
import type { JobPaperProposal, JobPaperProposalsIo } from '../../lib/jobs/jobPaperProposalsIo'
import type { BookSettingsPaper, JobPaperSettingsIo, JobSettingsPaper } from '../../lib/jobs/jobPaperSettingsIo'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const card: CSSProperties = { display: 'grid', gap: '0.45rem', padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderLeft: '3px solid var(--text-amber-800)', borderRadius: '0 7px 7px 0', background: 'var(--bg-amber-tint)' }
const bluePress: CSSProperties = { minHeight: 44, padding: '0.5rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontFamily: 'inherit' }
const quietPress: CSSProperties = { minHeight: 44, padding: '0.5rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }

export function JobPaperProposalCard({
  proposal,
  paper,
  paperName,
  io,
  settingsIo,
  disabled = false,
  onDecided,
  onOverlayOpenChange,
}: {
  proposal: JobPaperProposal
  /** The paper it waits on, as the job holds it: its Book entry and how many have signed. */
  paper: JobSettingsPaper
  paperName: string
  io: JobPaperProposalsIo
  settingsIo: JobPaperSettingsIo
  disabled?: boolean
  /** The answer landed: the section reads again. */
  onDecided: () => void | Promise<void>
  onOverlayOpenChange?: (open: boolean) => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const promptDialog = usePromptDialog()
  const [book, setBook] = useState<BookSettingsPaper | null>(null)
  const [busy, setBusy] = useState<'take' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // The list words each change. Without it the card still answers: it says how many topics move.
  useEffect(() => {
    let on = true
    settingsIo
      .readBookPaper(paper.bookDocumentId)
      .then((b) => {
        if (on) setBook(b)
      })
      .catch(() => {
        if (on) setBook(null)
      })
    return () => {
      on = false
    }
  }, [settingsIo, paper.bookDocumentId])

  const changes = book ? proposalChanges(book.def, proposal.fromPicks, proposal.picks) : []
  const moved = Object.keys(proposal.picks).filter((k) => proposal.picks[k] !== proposal.fromPicks[k]).length
  const take = takeWords(paper.signed)
  const day = proposal.proposedAt ? formatWorkDateYmdFriendly(calendarYmdInAppTzFromIso(proposal.proposedAt)) : null

  const answer = async (took: boolean) => {
    if (busy || disabled) return
    let why: string | undefined
    onOverlayOpenChange?.(true)
    if (took) {
      const ok = await confirmDialog({ title: take.title, message: take.lines.join(' '), confirmLabel: take.confirm })
      onOverlayOpenChange?.(false)
      if (!ok || !live.current) return
    } else {
      const typed = await promptDialog({ title: DECLINE_WORDS.title, message: `${DECLINE_WORDS.line} ${DECLINE_WORDS.whyLabel}:`, defaultValue: '', confirmLabel: DECLINE_WORDS.confirm })
      onOverlayOpenChange?.(false)
      if (typed === null || !live.current) return
      why = typed.trim() || undefined
    }
    setBusy(took ? 'take' : 'decline')
    setError(null)
    try {
      const done = await io.decide(proposal.id, took, why)
      if (!live.current) return
      showToast(decidedWords(done), 'success')
      await onDecided()
    } catch (e) {
      if (live.current) setError(formatErrorMessage(e, took ? 'The proposal was not taken.' : 'The proposal was not declined.'))
    } finally {
      if (live.current) setBusy(null)
    }
  }

  return (
    <div style={card} data-job-paper-proposal={proposal.id} role="group" aria-label={`A proposal on ${paperName}`}>
      <b style={{ color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.875rem' }}>{proposalHead(proposal.byName, day)}</b>
      {changes.length > 0 ? (
        <ValueLines>
          {changes.map((c) => (
            <ValueLine key={c.key} label={c.label}>
              <span>
                {c.from} to <WorkedOutValue>{c.to}</WorkedOutValue>
                {c.says ? <span style={{ ...muted, display: 'block' }}>{c.says}</span> : null}
              </span>
            </ValueLine>
          ))}
        </ValueLines>
      ) : (
        <p style={muted}>{moved === 1 ? '1 topic gets stricter.' : `${moved} topics get stricter.`}</p>
      )}
      <p style={muted}>The paper stays as it is until you take it.</p>
      {error ? (
        <div role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" style={bluePress} disabled={busy != null || disabled} onClick={() => void answer(true)}>
          {busy === 'take' ? 'Taking it…' : take.press}
        </button>
        <button type="button" style={quietPress} disabled={busy != null || disabled} onClick={() => void answer(false)}>
          {busy === 'decline' ? 'Declining…' : DECLINE_WORDS.press}
        </button>
      </div>
    </div>
  )
}

export default JobPaperProposalCard
