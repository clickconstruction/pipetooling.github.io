import { bankReturnedBadgeTitle, bankReturnedBadgeWords, type BankReturnedOnJob } from '../../lib/jobs/bankReturnedDeposits'
import type { PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { BILLED_SHELL_NO_BILL_LINE, stageRowBilledAgeDays, stageRowBilledAgeReference } from '../../lib/jobs/invoiceBilling'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { MoneyText } from '../Money'

/** What the row's They said… press opens the promise window with. */
export type StagesBilledRowPromiseTarget = { jobId: string; jobLabel: string; initialYmd: string | null }

/**
 * What a Billed or Collections row adds beside its buttons (the Stages map's step 23; v2.4168): the bank-returned ⚠, and
 * on a job-shell row (a billed job with no bill line, so nothing to age, v2.1931) its pill and its own They said…,
 * since the ledger has no money row to press on a shell. Lifted whole out of `JobsStagesTab.billedBillLineRenderer`,
 * which still decides whether a row has any extras at all.
 */
export function StagesBilledRowExtras({
  row,
  promise,
  bankReturned: bankRet,
  canMarkPromisedPay,
  onOpenPayments,
  onOpenPromise,
}: {
  row: StageRow
  /** The pay date the customer named for this job, when there is one. */
  promise: PromisedPayDate | null
  /** A deposit the bank returned that this job still counts as paid. */
  bankReturned: BankReturnedOnJob | null
  canMarkPromisedPay: boolean
  onOpenPayments: (job: JobWithDetails) => void
  onOpenPromise: (target: StagesBilledRowPromiseTarget) => void
}) {
  const shell = row.kind === 'job'
  const number = effectiveJobLedgerNumber(row.job.hcp_number, row.job.click_number) || '—'
  const label = `${number} · ${(row.job.job_name ?? '').trim() || 'Job'}`
  // B6 / J4-10: a Collections shell has a clock the office set — the flag
  // day — so it ages from there instead of wearing "can't age" forever.
  const collectionsRef = shell ? stageRowBilledAgeReference(row) : null
  const collectionsDays = collectionsRef?.source === 'collections' ? stageRowBilledAgeDays(row) : null
  const openPromise = () =>
    onOpenPromise({
      jobId: row.job.id,
      jobLabel: label,
      initialYmd: promise?.promisedYmd ?? null,
    })
  return (
    <>
      {bankRet ? (
        <button
          type="button"
          data-testid={`stages-bank-returned-${row.job.id}`}
          title={bankReturnedBadgeTitle(bankRet)}
          onClick={(e) => {
            e.stopPropagation()
            onOpenPayments(row.job)
          }}
          style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-red-800)', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          ⚠ <MoneyText text={bankReturnedBadgeWords(bankRet)} />
        </button>
      ) : null}
      {shell && collectionsRef?.source === 'collections' ? (
        <span
          title={`Flagged difficult to collect ${collectionsRef.ymd}. Nothing is on a bill line, so the clock runs from the flag — Bill Customer or Edit Job creates the line`}
          style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
        >
          {collectionsDays == null ? 'In Collections' : `In Collections ${collectionsDays} day${collectionsDays === 1 ? '' : 's'}`} · no bill line
        </span>
      ) : shell ? (
        <span
          title="This billed job's open money is on no bill line, so it can't age, be chased, or be forecast — Bill Customer or Edit Job creates the line"
          style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
        >
          {BILLED_SHELL_NO_BILL_LINE}
        </span>
      ) : null}
      {shell && canMarkPromisedPay ? (
        <button
          type="button"
          onClick={openPromise}
          title="Record the payment date the customer named, who said it and how — it overrides the estimate, and every date they name stays on record"
          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
        >
          {promise ? 'They said… (new date)' : 'They said…'}
        </button>
      ) : null}
    </>
  )
}
