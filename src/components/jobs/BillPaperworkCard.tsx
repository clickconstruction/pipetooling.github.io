import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { liveLienReleases, type JobLienReleaseRow } from '../../lib/jobs/lienReleaseTracking'
import { billSettled, lienWaiverCellForBill } from '../../lib/jobs/lienWaiverCell'
import { pickLienWaiverForBill } from '../../lib/jobsDocuments/lienWaiverRelease'
import { billPaperworkWaiverRow, type WaiverRowTone, type WaiverStepState } from '../../lib/jobs/billPaperworkWaiverRow'
import JobContractStrip from './JobContractStrip'
import JobWorkOrderStrip from './JobWorkOrderStrip'
import LienReleaseModal from './LienReleaseModal'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * View bill's paperwork card (v2.4299): the papers behind this bill as rows of one card — the
 * bill's lien waiver (GC jobs, or any job that already has a waiver), the job's contract and
 * its sub work order. The waiver row leads and holds the only filled button when a move is
 * owed; every door opens the Release of Lien window on this bill. Self-contained I/O
 * (`job_lien_releases`, the GC's billing email), fail-soft: a read error hides the waiver row.
 * Mock-up: https://claude.ai/artifact/QsK155GLJPu2yri9w74d1g (page View bill, pass 2).
 */

const btn: CSSProperties = {
  padding: '0.25rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }

const ROW_TONE: Record<WaiverRowTone, string | undefined> = {
  amber: 'var(--bg-amber-tint)',
  green: 'var(--bg-green-tint)',
  plain: undefined,
}

/** Status colors stay literal (CLAUDE.md theme rule): amber owed, green done, a hollow ring for later. */
const DOT: Record<WaiverStepState, CSSProperties> = {
  due: { background: '#d97706' },
  done: { background: '#059669' },
  open: { border: '1.5px solid var(--text-faint)' },
}

function ymdGapDays(fromYmd: string, toYmd: string): number {
  const ms = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((ms(toYmd) - ms(fromYmd)) / 86400000)
}

export default function BillPaperworkCard({
  job,
  invoice,
  billEmail,
  dueUnix,
}: {
  job: JobWithDetails
  invoice: JobsLedgerInvoice
  /** The email the bill went to (Stripe's copy), offered as the GC's waiver email when it has none. */
  billEmail: string | null
  /** The bill's due date from Stripe (unix seconds), for "N days past due". */
  dueUnix: number | null
}) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const [releases, setReleases] = useState<JobLienReleaseRow[] | null>(null)
  const [gcEmail, setGcEmail] = useState<string | null>(null)
  const [windowOpen, setWindowOpen] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const gcId = job.gc_customer_id ?? null

  const load = useCallback(async () => {
    try {
      const [{ data: rows, error }, gc] = await Promise.all([
        supabase.from('job_lien_releases').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
        gcId ? supabase.from('customers').select('billing_email').eq('id', gcId).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (error) throw error
      setReleases((rows ?? []) as JobLienReleaseRow[])
      setGcEmail(((gc.data as { billing_email: string | null } | null)?.billing_email ?? '').trim() || null)
    } catch {
      setReleases(null)
    }
  }, [job.id, gcId])

  useEffect(() => {
    void load()
  }, [load])

  const live = releases ? liveLienReleases(releases) : []
  const showWaiver = releases != null && (Boolean(gcId) || live.length > 0)

  let waiverRow: JSX.Element | null = null
  let waiverOwed = false
  if (showWaiver && releases) {
    const payments = job.payments ?? []
    const settled = billSettled(invoice, payments)
    const cell = lienWaiverCellForBill(releases, invoice.id, settled)
    const pick = pickLienWaiverForBill(job, invoice)
    const todayYmd = denverCalendarDayKey(Date.now())
    const dueYmd = dueUnix != null ? denverCalendarDayKey(dueUnix * 1000) : null
    const paidYmd = settled
      ? payments
          .filter((p) => p.invoice_id === invoice.id)
          .map((p) => (p.paid_on ?? '').trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort()
          .pop() ?? null
      : null
    const row = billPaperworkWaiverRow({
      cell,
      pick,
      amount: Number(invoice.amount ?? 0),
      isGc: Boolean(gcId),
      recipientName: gcId ? (job.gcCustomer?.name ?? '').trim() : (job.customer_name ?? '').trim(),
      recipientEmail: gcId ? gcEmail : (job.customer_email ?? '').trim() || null,
      billEmail,
      daysPastDue: dueYmd ? ymdGapDays(dueYmd, todayYmd) : null,
      paidYmd,
    })
    waiverOwed = row.action.primary

    const saveEmail = async (email: string) => {
      if (!gcId || savingEmail) return
      setSavingEmail(true)
      try {
        // Only fills a blank: never overwrites an email someone typed on the GC's record.
        await withSupabaseRetry(
          () => supabase.from('customers').update({ billing_email: email }).eq('id', gcId).is('billing_email', null),
          'save GC billing email',
        )
        await load()
        showToast(`Saved. Waivers for ${job.gcCustomer?.name ?? 'this GC'} go to ${email}.`, 'success')
      } catch {
        showToast('Could not save the email.', 'error')
      } finally {
        setSavingEmail(false)
      }
    }

    waiverRow = (
      <div className="billPaperworkRow" style={{ background: ROW_TONE[row.tone] }} data-testid="paperwork-waiver-row" data-tone={row.tone}>
        <span className="billPaperworkLabel">Lien waiver</span>
        <span style={{ minWidth: 0, fontWeight: 600 }}>{row.headline}</span>
        <span className="billPaperworkControls">
          <button type="button" style={row.action.primary ? btnPrimary : btn} onClick={() => setWindowOpen(true)} data-testid="paperwork-waiver-door" title="Opens the Release of Lien window on this bill. Pick the form, the leader signs, then send it.">
            {row.action.label}
          </button>
        </span>
        {row.sub ? (
          <span className="billPaperworkUnder" style={{ fontSize: '0.75rem', color: row.subTone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }} data-testid="paperwork-waiver-sub">
            {row.sub}
          </span>
        ) : null}
        <span className="billPaperworkUnder" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.6875rem', color: 'var(--text-muted)' }} data-testid="paperwork-waiver-steps">
          {row.steps.map((s, i) => (
            <span key={i} className="billPaperworkStep">
              {i > 0 ? <span aria-hidden className="billPaperworkStepJoin" style={{ width: 14, height: 1, background: 'var(--border-strong)', marginRight: '0.3rem' }} /> : null}
              <span className="billPaperworkDot" style={DOT[s.state]} aria-hidden />
              {s.text}
            </span>
          ))}
        </span>
        {row.emailFix ? (
          <span className="billPaperworkUnder" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="paperwork-waiver-email-fix">
            {job.gcCustomer?.name ?? 'The GC'} has no email for waivers yet.{' '}
            <button type="button" className="billPaperworkLink" disabled={savingEmail} onClick={() => void saveEmail(row.emailFix!.email)}>
              {savingEmail ? 'Saving…' : `Use ${row.emailFix.email}`}
            </button>
            , the one on this bill.
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="billPaperworkCard" data-testid="bill-paperwork-card">
      {waiverRow}
      <JobContractStrip job={job} variant="row" quiet={waiverOwed} />
      <JobWorkOrderStrip job={job} variant="row" authUserId={undefined} readOnly />
      {showWaiver ? (
        <LienReleaseModal
          open={windowOpen}
          onClose={() => {
            setWindowOpen(false)
            void load()
          }}
          job={job}
          invoice={invoice}
          signerNameFallback={(profileName ?? '').trim()}
          onIssued={() => void load()}
        />
      ) : null}
    </div>
  )
}
