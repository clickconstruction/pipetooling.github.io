import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { recordRetainageHeld } from '../../lib/ar/retainageHeldIo'
import { retainageUnrecordedWhy, type RetainageUnrecordedRow } from '../../lib/ar/retainageSuggested'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MoneyText } from '../Money'

/**
 * Retainage the desk was never told about (the owner's pick of 2026-11-16, fix A of the
 * retainage clock check). The top of By paper → Retainage notices lists the open jobs under a GC
 * whose bills were paid at exactly 90% or 95%, or whose notes say retainage, while the lien
 * details hold no answer. Such a job has no § 53.057 clock and its monthly notice names no
 * retainage. The office records the figure the bills show, opens the job to type another, or
 * answers that there is none. Each press writes the one column the lien details write, then the
 * desk reads again and the job takes its place under *Clock not started*. Nothing is drawn when
 * no job is in this state.
 *
 * The rows are the desk's own read (`useLienDeskData`, PR 2), the same ones To do's rows and the
 * Board's count stand on; `focusJobId` is the job a To do row was pressed for.
 */

const money = (n: number): string => `$${formatCurrency(n)}`

const press: CSSProperties = { padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, border: '1px solid currentColor', background: 'none', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }

export function LienRetainageUnrecorded({
  rows,
  failure,
  office,
  focusJobId,
  onOpenLienContract,
  onRecorded,
}: {
  rows: ReadonlyArray<RetainageUnrecordedRow>
  /** Why the desk could not read them, in words; null when it could. */
  failure?: string | null
  office: boolean
  /** The job a To do row opened the list for: its row is brought into view and ringed. */
  focusJobId?: string | null
  onOpenLienContract: (jobId: string) => void
  onRecorded: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  // A job just answered leaves the list at once; the desk's next read drops it for good.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set())
  const focusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (focusJobId && focusRef.current?.scrollIntoView) focusRef.current.scrollIntoView({ block: 'nearest' })
  }, [focusJobId, rows])

  const record = useCallback(
    async (row: RetainageUnrecordedRow, amount: number) => {
      const job = `Job ${row.label}${row.name ? ` · ${row.name}` : ''}`
      const holder = row.heldBy || 'the GC'
      const ok = await confirmDialog(
        amount > 0
          ? {
              title: 'Record the retainage on the job?',
              message: `${job}: ${money(amount)} is recorded as the retainage ${holder} holds back. The job joins the retainage list under Clock not started, and its next monthly notice names the figure. Change it any time in Edit Job.`,
              confirmLabel: `Record ${money(amount)}`,
            }
          : {
              title: 'Record that this job has no retainage?',
              message: `${job}: the job is recorded with no retainage held by ${holder}, and it leaves this list. Change it any time in Edit Job.`,
              confirmLabel: 'Record no retainage',
            },
      )
      if (!ok) return
      setBusyJobId(row.jobId)
      try {
        await recordRetainageHeld(row.jobId, amount)
        showToast(amount > 0 ? `${money(amount)} of retainage recorded on job ${row.label}. Set the day our contract ended when the work is done.` : `Job ${row.label} recorded with no retainage.`, 'success')
        setAnswered((prev) => new Set(prev).add(row.jobId))
        onRecorded()
      } catch (e) {
        showToast(formatErrorMessage(e, 'The retainage could not be recorded.'), 'error')
      } finally {
        setBusyJobId(null)
      }
    },
    [confirmDialog, onRecorded, showToast],
  )

  const shown = rows.filter((r) => !answered.has(r.jobId))
  if (failure && shown.length === 0) {
    return (
      <p data-testid="lien-retainage-unrecorded-failure" style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        {failure}
      </p>
    )
  }
  if (shown.length === 0) return null

  return (
    <section data-testid="lien-retainage-unrecorded" aria-label="Retainage that looks held and is not on the job" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', padding: '0.55rem 0.75rem', display: 'grid', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.8125rem' }}>
        <strong>Looks held · not on the job · {shown.length}</strong>
        <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
          The money or the notes on {shown.length === 1 ? 'this job say' : 'these jobs say'} the GC holds retainage. Nothing is recorded, so there is no § 53.057 clock and no monthly notice names it.
        </div>
      </div>
      {shown.map((row) => {
        const busy = busyJobId === row.jobId
        const focused = focusJobId === row.jobId
        return (
          <div
            key={row.jobId}
            ref={focused ? focusRef : undefined}
            data-testid="lien-retainage-unrecorded-row"
            data-job-id={row.jobId}
            data-focused={focused ? 'yes' : 'no'}
            style={{ display: 'grid', gap: 4, padding: '0.4rem 0.5rem', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border)', boxShadow: focused ? '0 0 0 2px var(--surface), 0 0 0 4px var(--text-link)' : 'none' }}
          >
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
              {row.label}
              {row.name ? ` · ${row.name}` : ''}
              {row.heldBy ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> · {row.heldBy}</span> : null}
            </div>
            <div data-testid="lien-retainage-unrecorded-why" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <MoneyText text={retainageUnrecordedWhy(row)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', color: 'var(--text-link)' }}>
              {office && row.suggestion ? (
                <button type="button" disabled={busy} onClick={() => void record(row, row.suggestion!.held)} style={{ ...press, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }} data-testid="lien-retainage-unrecorded-record">
                  {busy ? 'Recording…' : <MoneyText text={`Record ${money(row.suggestion.held)} on the job`} />}
                </button>
              ) : null}
              <button type="button" onClick={() => onOpenLienContract(row.jobId)} style={press} data-testid="lien-retainage-unrecorded-open">
                {row.suggestion ? 'Type another figure ›' : 'Type the figure on the job ›'}
              </button>
              {office ? (
                <button type="button" disabled={busy} onClick={() => void record(row, 0)} style={{ ...press, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }} data-testid="lien-retainage-unrecorded-none">
                  No retainage on this job
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </section>
  )
}
