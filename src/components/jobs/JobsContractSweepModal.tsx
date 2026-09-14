/**
 * The contract sweep (Contract Desk PR 4 → Contract sweep PR 1): every live
 * job with nothing on file, one row each, wearing the state the app already
 * knows — Ready · Scope is just the name · No amount · No email · GC job ·
 * "+ J798" — from `contractSweepRowState.ts`. The header counts the pile,
 * To send · Needs a look · All splits it, the row's one button follows its
 * state, and Send all lives under ⋯, takes only Ready rows, and says how
 * many customers it will email. PR 2 adds the pane that shows the agreement.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { quickSendJobContract, type QuickSendTemplate } from '../../lib/jobs/jobContractQuickSend'
import { isContractGap, type JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { formatContractFloor } from '../../lib/jobs/jobContractFloor'
import { buildJobContractPrefill, type EstimateLineForPrefill } from '../../lib/jobs/jobContractDocument'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import {
  assessContractSweepRows,
  contractSweepFilterMatches,
  contractSweepSummary,
  CONTRACT_SWEEP_FILTER_LABELS,
  CONTRACT_SWEEP_FILTERS,
  CONTRACT_SWEEP_FLAG_LABELS,
  type ContractSweepFilter,
  type ContractSweepRowInput,
  type ContractSweepRowState,
} from '../../lib/jobs/contractSweepRowState'
import { ArHeaderMenu } from './ar/ArHeaderMenu'
import JobContractModal from './JobContractModal'

type TemplateRow = NonNullable<QuickSendTemplate>
type AcceptedEstimate = { lines: EstimateLineForPrefill[]; totalCents: number | null }

const BUILTIN = '__builtin__'
const btn: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.25rem 0.45rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.74rem',
}
const CHIP_TONE: Record<'green' | 'amber' | 'red' | 'blue', { bg: string; fg: string; border: string }> = {
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border-green)' },
  amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
  red: { bg: 'var(--surface)', fg: 'var(--text-red-700)', border: 'var(--border-red)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--border-strong)' },
}
function chipStyle(tone: keyof typeof CHIP_TONE): CSSProperties {
  const t = CHIP_TONE[tone]
  return { display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap', background: t.bg, color: t.fg, border: `1px solid ${t.border}` }
}
function segStyle(active: boolean): CSSProperties {
  return { padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: 'none', background: active ? 'var(--bg-blue-tint)' : 'transparent', color: active ? 'var(--text-link)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: active ? 700 : 500, font: 'inherit' }
}

const STATUS_LABEL: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to bill', billed: 'Billed' }

/** The job's customer is a builder whose own subcontract is the agreement: a GC that is not the customer row. */
export function sweepRowIsGcJob(j: Pick<JobWithDetails, 'gc_customer_id' | 'customer_id'>): boolean {
  return Boolean(j.gc_customer_id) && j.gc_customer_id !== j.customer_id
}

/** State chips for one row — "+ J798" first, then the readiness flags. */
export function SweepRowChips({ state }: { state: ContractSweepRowState }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }} data-testid="sweep-row-chips">
      {state.sameEmailAs.length > 0 ? (
        <span style={chipStyle('blue')} title={`This customer also has ${state.sameEmailAs.map((n) => `J${n}`).join(', ')} in the sweep — each job sends its own agreement`}>
          + {state.sameEmailAs.map((n) => `J${n}`).join(' · ')}
        </span>
      ) : null}
      {state.flags.map((f) => {
        const l = CONTRACT_SWEEP_FLAG_LABELS[f]
        return (
          <span key={f} style={chipStyle(l.tone)} title={l.title} data-flag={f}>
            {l.text}
          </span>
        )
      })}
    </span>
  )
}

export default function JobsContractSweepModal({
  open,
  onClose,
  jobs,
  coverage,
  floorCents = 0,
  onEditJob,
  onSent,
  onJobChanged,
  onFilterBoard,
}: {
  open: boolean
  onClose: () => void
  /** Every loaded job; the modal keeps the ones without an agreement. */
  jobs: JobWithDetails[]
  coverage: ReadonlyMap<string, JobContractCoverage>
  /** The contract floor in cents (PR 0); jobs with an amount under it are not in the sweep. 0 = no floor. */
  floorCents?: number
  onEditJob: (job: JobWithDetails) => void
  onSent: () => void
  /** A job row itself changed (Not needed answered) — the caller reloads the jobs list. */
  onJobChanged?: () => void
  /** ⋯ → Filter the Pipeline to these jobs: the caller closes the sweep and sets the No-contract filter. */
  onFilterBoard?: () => void
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templateId, setTemplateId] = useState(BUILTIN)
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(() => new Set())
  const [sendAllArmed, setSendAllArmed] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)
  const [detail, setDetail] = useState<{ job: JobWithDetails; filing: boolean } | null>(null)
  const [filter, setFilter] = useState<ContractSweepFilter>('to_send')
  const [accepted, setAccepted] = useState<ReadonlyMap<string, AcceptedEstimate>>(() => new Map())

  const gapRows = useMemo(() => {
    const order: Record<string, number> = { working: 0, waiting: 1, ready_to_bill: 2, billed: 3 }
    return jobs
      .filter((j) => {
        const status = (j.status ?? '') as string
        return status !== 'paid' && isContractGap(coverage.get(j.id), j.revenue, floorCents) && !sentIds.has(j.id)
      })
      .sort((a, b) => (order[a.status ?? ''] ?? 9) - (order[b.status ?? ''] ?? 9) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  }, [jobs, coverage, sentIds, floorCents])

  // Templates once per open; the accepted estimates for the rows on screen (the
  // same prefill the Contract modal uses) whenever the row set changes.
  useEffect(() => {
    if (!open) return
    setSentIds(new Set())
    setSendAllArmed(false)
    setFilter('to_send')
    void (async () => {
      const { data } = await supabase
        .from('contract_template_documents')
        .select('id, document_name, book_body_html, book_body_format, book_version_date')
        .eq('audience', 'customer')
        .order('document_name')
      const list = (data ?? []) as TemplateRow[]
      setTemplates(list)
      if (list[0]) setTemplateId(list[0].id)
    })()
  }, [open])
  const gapIdsKey = gapRows.map((j) => j.id).join(',')
  useEffect(() => {
    if (!open || !gapIdsKey) return
    let cancelled = false
    void (async () => {
      const ids = gapIdsKey.split(',')
      const next = new Map<string, AcceptedEstimate>()
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150)
        const { data } = await supabase.from('estimates').select('job_ledger_id, line_items_snapshot, total_cents').eq('status', 'customer_accepted').in('job_ledger_id', chunk)
        for (const row of (data ?? []) as { job_ledger_id: string | null; line_items_snapshot: unknown; total_cents: number | null }[]) {
          if (!row.job_ledger_id || next.has(row.job_ledger_id)) continue
          next.set(row.job_ledger_id, {
            lines: normalizeEstimateLineItemsFromJson(row.line_items_snapshot).map((l) => ({ line_item: l.line_item, description: l.description, quantity: l.quantity })),
            totalCents: row.total_cents,
          })
        }
      }
      if (!cancelled) setAccepted(next)
    })()
    return () => {
      cancelled = true
    }
  }, [open, gapIdsKey])

  const emailFor = (j: JobWithDetails) => emails[j.id] ?? (j.customer_email ?? '').trim()
  const template: QuickSendTemplate = templates.find((t) => t.id === templateId) ?? null
  const templateName = template ? template.document_name : 'Built-in service agreement terms'

  /** What each row would mint, through the same prefill the send uses. */
  const inputs = useMemo<ContractSweepRowInput[]>(
    () =>
      gapRows.map((j) => {
        const est = accepted.get(j.id)
        const fields = buildJobContractPrefill({ job: j, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
        return {
          id: j.id,
          jobNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
          jobName: (j.job_name ?? '').trim(),
          email: emailFor(j),
          revenue: fields.amount_cents != null ? fields.amount_cents / 100 : null,
          scopeLines: fields.scope_lines,
          gcJob: sweepRowIsGcJob(j),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gapRows, accepted, emails],
  )
  const states = useMemo(() => assessContractSweepRows(inputs), [inputs])
  const summary = useMemo(() => contractSweepSummary(inputs, states), [inputs, states])
  const visibleRows = gapRows.filter((j) => contractSweepFilterMatches(states.get(j.id), filter))
  const readyRows = gapRows.filter((j) => states.get(j.id)?.readyForBulk)

  const sendOne = async (j: JobWithDetails): Promise<boolean> => {
    setBusyId(j.id)
    try {
      const est = accepted.get(j.id)
      const res = await quickSendJobContract({
        job: j,
        template,
        recipientEmail: emailFor(j),
        recipientName: (j.customer_name ?? '').trim(),
        authUserId: authUser?.id ?? null,
        estimateLines: est?.lines ?? [],
        acceptedTotalCents: est?.totalCents ?? null,
      })
      if (!res.ok) {
        showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: ${res.error}`, 'error')
        return false
      }
      setSentIds((prev) => new Set([...prev, j.id]))
      if (!res.emailed) showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: link minted but the email did not send.`, 'error')
      return true
    } finally {
      setBusyId(null)
    }
  }

  const sendAll = async () => {
    setSendingAll(true)
    let n = 0
    try {
      for (const j of readyRows) {
        if (await sendOne(j)) n++
      }
      showToast(`Sent ${n} contract${n === 1 ? '' : 's'}.`, 'success')
      onSent()
    } finally {
      setSendingAll(false)
      setSendAllArmed(false)
    }
  }

  if (!open) return null

  const filterCounts: Record<ContractSweepFilter, number> = { to_send: summary.toSend, needs_look: summary.needsLook, all: summary.all }
  const menuItems = [
    ...(summary.toSend > 0
      ? [
          {
            key: 'send-all',
            label: `Send all ${summary.toSend} ready…`,
            hint: `${summary.customersToEmail} customer${summary.customersToEmail === 1 ? '' : 's'} · ${templateName} · skips Needs a look`,
            onSelect: () => setSendAllArmed(true),
          },
        ]
      : []),
    ...(onFilterBoard ? [{ key: 'filter-board', label: 'Filter the Pipeline to these jobs', hint: 'The No-contract filter — the same rule as this list', onSelect: onFilterBoard }] : []),
  ]

  return (
    <ResponsiveModalShell
      title="Contract sweep"
      onRequestClose={onClose}
      maxWidthDesktop={940}
      headerAction={<ArHeaderMenu items={menuItems} ariaLabel="Contract sweep tools" />}
      footer={
        sendAllArmed ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }} data-testid="sweep-send-all-confirm">
            <span>
              Email <b>{summary.customersToEmail} customer{summary.customersToEmail === 1 ? '' : 's'}</b> ({summary.toSend} agreement{summary.toSend === 1 ? '' : 's'}) with <b>{templateName}</b>? Reminders follow every 3 days, up to 3 times. Rows that need a look are skipped.
            </span>
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={btn} disabled={sendingAll} onClick={() => setSendAllArmed(false)}>
                Cancel
              </button>
              <button type="button" style={{ ...btnPrimary, background: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' }} disabled={sendingAll || busyId != null} onClick={() => void sendAll()}>
                {sendingAll ? 'Sending…' : `Confirm — send ${summary.toSend} now`}
              </button>
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Terms</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...input, width: 'auto', minWidth: 220, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }} aria-label="Terms for every job in this sweep">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.document_name}
                  </option>
                ))}
                <option value={BUILTIN}>Built-in service agreement terms</option>
              </select>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>applies to every job in this sweep</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send all is under ⋯ and takes only Ready rows.</span>
          </div>
        )
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} data-testid="sweep-summary">
          <b style={{ color: 'var(--text-strong)' }}>{summary.all} without a contract</b> · {formatUsdNoCents(summary.revenueTotal)} of work · {summary.needsLook} need{summary.needsLook === 1 ? 's' : ''} a look
          {sentIds.size > 0 ? ` · ${sentIds.size} sent this sweep` : ''}
          {floorCents > 0 ? ` · under ${formatContractFloor(floorCents)} left out` : ''}
        </div>
        <div role="group" aria-label="Which rows to show" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {CONTRACT_SWEEP_FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} style={segStyle(filter === f)}>
              {CONTRACT_SWEEP_FILTER_LABELS[f]} · {filterCounts[f]}
            </button>
          ))}
        </div>
      </div>
      {gapRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Every live job has an agreement on file, or doesn&apos;t need one. 🎉</p>
      ) : visibleRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{filter === 'to_send' ? 'Nothing is ready to send as-is — every remaining row needs a look.' : 'Nothing needs a look.'}</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {visibleRows.map((j) => {
            const num = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
            const email = emailFor(j)
            const st = states.get(j.id)
            const inp = inputs.find((x) => x.id === j.id)
            const amount = inp?.revenue != null && inp.revenue > 0 ? formatUsdNoCents(inp.revenue) : 'no amount'
            const action = st?.action ?? 'send'
            return (
              <div key={j.id} data-testid="sweep-row" data-job={num} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto 200px', gap: '0.15rem 0.75rem', alignItems: 'center', padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                <div style={{ minWidth: 0 }}>
                  <button type="button" onClick={() => setDetail({ job: j, filing: false })} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }} title="Open the Contract modal for this job">
                    J{num} · {(j.job_name ?? '').trim() || 'Job'}
                  </button>
                  {(j.customer_name ?? '').trim() ? <span style={{ color: 'var(--text-muted)' }}> · {(j.customer_name ?? '').trim()}</span> : null}
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: inp?.revenue ? 'inherit' : 'var(--text-faint)' }}>{amount}</div>
                <input
                  style={{ ...input, ...(email && !st?.emailOk ? { borderColor: 'var(--text-red-700)' } : {}) }}
                  type="email"
                  value={email}
                  placeholder="no email on job"
                  onChange={(e) => setEmails((prev) => ({ ...prev, [j.id]: e.target.value }))}
                  aria-label={`Signer email for job ${num}`}
                />
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(j.job_address ?? '').trim() || '—'} · {STATUS_LABEL[j.status ?? ''] ?? j.status}
                </div>
                <div style={{ textAlign: 'right' }}>{st ? <SweepRowChips state={st} /> : null}</div>
                <div style={{ textAlign: 'right' }}>
                  {action === 'send' ? (
                    <button type="button" style={btnPrimary} disabled={busyId != null || sendingAll} onClick={() => void sendOne(j).then((sent) => sent && onSent())}>
                      {busyId === j.id ? 'Sending…' : 'Send'}
                    </button>
                  ) : action === 'fix_email' ? (
                    <button type="button" style={btn} onClick={() => onEditJob(j)}>
                      Fix email
                    </button>
                  ) : action === 'file_theirs' ? (
                    <button type="button" style={btnPrimary} onClick={() => setDetail({ job: j, filing: true })} title="The builder's subcontract is the agreement — file it">
                      File theirs
                    </button>
                  ) : (
                    <button type="button" style={btn} onClick={() => setDetail({ job: j, filing: false })} title="Type the scope in the Contract modal, then send from there">
                      Add scope
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <JobContractModal
        open={detail != null}
        onClose={() => setDetail(null)}
        job={detail?.job ?? null}
        initialFilingOpen={detail?.filing ?? false}
        onChanged={() => {
          onSent()
        }}
        onJobChanged={onJobChanged}
      />
    </ResponsiveModalShell>
  )
}
