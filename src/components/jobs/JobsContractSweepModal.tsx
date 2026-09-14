/**
 * The contract sweep (Contract Desk PR 4 → Contract sweep PR 1 / PR 2): every
 * live job with nothing on file as a queue on the left, wearing the state the
 * app already knows (`contractSweepRowState.ts`), and the selected job's
 * agreement on the right, rendered from the same fields the send will mint —
 * nothing sends unseen. The footer says what the primary will do and which
 * job comes next; Send & next is the fast path. Send all lives under ⋯, takes
 * only Ready rows, and says how many customers it will email. PR 3: the scope
 * and the amount are editable right above the document; edits autosave to the
 * job's draft — the row the send reuses — and the row's readiness follows.
 * PR 4: filing a signed copy happens in the pane (Already signed? File it,
 * File their subcontract) or by dropping a PDF / photo on a row; the shared
 * JobContractFileSheet writes it and the row leaves the queue.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { quickSendJobContract, type QuickSendTemplate } from '../../lib/jobs/jobContractQuickSend'
import { isContractGap, type JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { formatContractFloor } from '../../lib/jobs/jobContractFloor'
import { buildJobContractDocumentHtml, buildJobContractPrefill, DEFAULT_JOB_CONTRACT_TERMS_PLAIN, jobContractHeading, parseJobContractFields, type EstimateLineForPrefill, type JobContractFields } from '../../lib/jobs/jobContractDocument'
import { formatContractStamp, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { buildJobContractDraftPayload, saveJobContractDraft } from '../../lib/jobs/jobContractDraftWrite'
import { dispatchJobContractChanged } from '../../lib/jobs/jobContractNotNeeded'
import JobContractFileSheet from './JobContractFileSheet'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import {
  assessContractSweepRows,
  contractSweepFilterMatches,
  contractSweepFooterSentence,
  contractSweepPrimary,
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
const btnGhost: CSSProperties = { ...btn, borderColor: 'transparent', background: 'transparent', color: 'var(--text-link)', fontWeight: 500, padding: '0.3rem 0.3rem' }
const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.3rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.78rem',
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
const kLabel: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

const STATUS_LABEL: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to bill', billed: 'Billed' }

/** The job's customer is a builder whose own subcontract is the agreement: a GC that is not the customer row. */
function sweepRowIsGcJob(j: Pick<JobWithDetails, 'gc_customer_id' | 'customer_id'>): boolean {
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
  const isMobile = useIsMobile()
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** The selected job's live draft/sent row, when it has one — the send reuses it, so the pane shows it (PR 2). */
  const [draft, setDraft] = useState<{ jobId: string; row: JobContractRow | null } | null>(null)
  const [issuerReady, setIssuerReady] = useState(false)
  /** PR 3: what the office typed for the selected job — scope one line per item, the amount as text. */
  const [paneEdit, setPaneEdit] = useState<{ jobId: string; scopeText: string; amountText: string; dirty: boolean } | null>(null)
  /** Saved edits per job, so the row's chips follow what was typed after the selection moves on. */
  const [overrides, setOverrides] = useState<Record<string, { scopeLines: string[]; amountCents: number | null }>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<number | null>(null)
  /** PR 4: the filing sheet open in the pane for a job, with a file when one was dropped on the row. */
  const [filing, setFiling] = useState<{ jobId: string; file: File | null } | null>(null)
  const [filedIds, setFiledIds] = useState<ReadonlySet<string>>(() => new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const gapRows = useMemo(() => {
    const order: Record<string, number> = { working: 0, waiting: 1, ready_to_bill: 2, billed: 3 }
    return jobs
      .filter((j) => {
        const status = (j.status ?? '') as string
        return status !== 'paid' && isContractGap(coverage.get(j.id), j.revenue, floorCents) && !sentIds.has(j.id) && !filedIds.has(j.id)
      })
      .sort((a, b) => (order[a.status ?? ''] ?? 9) - (order[b.status ?? ''] ?? 9) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  }, [jobs, coverage, sentIds, filedIds, floorCents])

  // Templates + the letterhead once per open; the accepted estimates for the
  // rows on screen (the same prefill the Contract modal uses) whenever the row set changes.
  useEffect(() => {
    if (!open) return
    setSentIds(new Set())
    setFiledIds(new Set())
    setFiling(null)
    setSendAllArmed(false)
    setFilter('to_send')
    setSelectedId(null)
    setDraft(null)
    setPaneEdit(null)
    setOverrides({})
    setSaveState('idle')
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
    void fetchPhysicalInvoiceIssuerFromAppSettings()
      .catch(() => undefined)
      .then(() => setIssuerReady(true))
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

  const emailFor = useCallback((j: JobWithDetails) => emails[j.id] ?? (j.customer_email ?? '').trim(), [emails])
  const template: QuickSendTemplate = templates.find((t) => t.id === templateId) ?? null
  const templateName = template ? template.document_name : 'Built-in service agreement terms'

  /** What each row would mint, through the same prefill the send uses. */
  const inputs = useMemo<ContractSweepRowInput[]>(
    () =>
      gapRows.map((j) => {
        const est = accepted.get(j.id)
        const fields = buildJobContractPrefill({ job: j, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
        const ov = overrides[j.id]
        const amountCents = ov ? ov.amountCents : fields.amount_cents
        return {
          id: j.id,
          jobNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
          jobName: (j.job_name ?? '').trim(),
          email: emailFor(j),
          revenue: amountCents != null ? amountCents / 100 : null,
          scopeLines: ov ? ov.scopeLines : fields.scope_lines,
          gcJob: sweepRowIsGcJob(j),
        }
      }),
    [gapRows, accepted, emailFor, overrides],
  )
  const states = useMemo(() => assessContractSweepRows(inputs), [inputs])
  const summary = useMemo(() => contractSweepSummary(inputs, states), [inputs, states])
  // The selected row stays on screen even when an edit moves it out of the filter (a thin row that became Ready) — it leaves when the selection moves on.
  const visibleRows = useMemo(() => gapRows.filter((j) => j.id === selectedId || contractSweepFilterMatches(states.get(j.id), filter)), [gapRows, states, filter, selectedId])
  const readyRows = gapRows.filter((j) => states.get(j.id)?.readyForBulk)

  // Selection follows the visible list: the first row on desktop, none until a tap on phones.
  useEffect(() => {
    if (!open) return
    if (selectedId && visibleRows.some((j) => j.id === selectedId)) return
    setSelectedId(isMobile ? null : (visibleRows[0]?.id ?? null))
  }, [open, visibleRows, selectedId, isMobile])
  const selected = selectedId ? (visibleRows.find((j) => j.id === selectedId) ?? null) : null
  const selectedIndex = selected ? visibleRows.findIndex((j) => j.id === selected.id) : -1
  const nextRow = selectedIndex >= 0 ? (visibleRows[selectedIndex + 1] ?? null) : null

  // The selected job's live row (the send reuses a draft/sent row rather than minting a second one).
  useEffect(() => {
    if (!open || !selected) return
    const jobId = selected.id
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('job_contracts').select('*').eq('job_id', jobId).in('status', ['draft', 'sent']).is('voided_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!cancelled) setDraft({ jobId, row: (data ?? null) as JobContractRow | null })
    })()
    return () => {
      cancelled = true
    }
  }, [open, selected])
  const draftRow = draft && selected && draft.jobId === selected.id ? draft.row : null
  const draftKnown = Boolean(draft && selected && draft.jobId === selected.id)

  // PR 3: once the selected job's draft is known, the edit fields start from it (or the prefill).
  useEffect(() => {
    if (!open || !selected || !draftKnown) return
    if (paneEdit && paneEdit.jobId === selected.id) return
    const est = accepted.get(selected.id)
    const f = draftRow ? parseJobContractFields(draftRow.fields) : buildJobContractPrefill({ job: selected, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
    setPaneEdit({ jobId: selected.id, scopeText: f.scope_lines.join('\n'), amountText: f.amount_cents != null ? (f.amount_cents / 100).toFixed(2) : '', dirty: false })
    setSaveState(draftRow ? 'saved' : 'idle')
    if (draftRow) setOverrides((prev) => (prev[selected.id] ? prev : { ...prev, [selected.id]: { scopeLines: f.scope_lines, amountCents: f.amount_cents } }))
  }, [open, selected, draftKnown, draftRow, accepted, paneEdit])

  const editedFields = useCallback(
    (job: JobWithDetails, edit: { scopeText: string; amountText: string }): JobContractFields => {
      const est = accepted.get(job.id)
      const base = draftRow && draftRow.job_id === job.id ? parseJobContractFields(draftRow.fields) : buildJobContractPrefill({ job, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
      const n = Number(edit.amountText.replace(/[$,\s]/g, ''))
      return {
        ...base,
        scope_lines: edit.scopeText.split('\n').map((l) => l.trim()).filter(Boolean),
        amount_cents: edit.amountText.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null,
      }
    },
    [accepted, draftRow],
  )

  /** Write the pane's edits to the job's draft now (the send gate calls this too). */
  const flushPaneEdit = useCallback(async (): Promise<JobContractRow | null> => {
    if (!selected || !paneEdit || paneEdit.jobId !== selected.id) return draftRow
    if (draftRow && draftRow.status === 'sent') return draftRow
    if (!paneEdit.dirty) return draftRow
    const fields = editedFields(selected, paneEdit)
    setSaveState('saving')
    try {
      const row = await saveJobContractDraft({
        existing: draftRow,
        payload: buildJobContractDraftPayload({ jobId: selected.id, fields, template, recipientName: (selected.customer_name ?? '').trim(), recipientEmail: emailFor(selected), recipientPhone: selected.customer_phone ?? null }),
        authUserId: authUser?.id ?? null,
      })
      if (row) setDraft({ jobId: selected.id, row })
      setOverrides((prev) => ({ ...prev, [selected.id]: { scopeLines: fields.scope_lines, amountCents: fields.amount_cents } }))
      setPaneEdit((prev) => (prev && prev.jobId === selected.id ? { ...prev, dirty: false } : prev))
      setSaveState('saved')
      return row
    } catch {
      setSaveState('error')
      return null
    }
  }, [selected, paneEdit, draftRow, editedFields, template, emailFor, authUser?.id])
  const flushRef = useRef(flushPaneEdit)
  flushRef.current = flushPaneEdit

  // Debounced autosave from the first real edit.
  useEffect(() => {
    if (!paneEdit?.dirty) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => void flushRef.current(), 600)
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [paneEdit])

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

  /** Send the selected job; with `andNext` the selection lands on the row that followed it. */
  const sendSelected = async (andNext: boolean) => {
    if (!selected) return
    const next = nextRow
    if (paneEdit?.dirty) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      const row = await flushPaneEdit()
      if (!row && saveState === 'error') return
    }
    const sent = await sendOne(selected)
    if (!sent) return
    onSent()
    setSelectedId(andNext ? (next?.id ?? null) : isMobile ? null : (next?.id ?? null))
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

  /** A file dropped on a row: select the job and open the filing sheet with the file in it — one click to record. */
  const acceptDroppedFile = (j: JobWithDetails, file: File | null) => {
    setDragOverId(null)
    if (!file) return
    const okType = /^(application\/pdf|image\/(png|jpeg))$/.test(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name)
    if (!okType) {
      showToast('Drop a PDF, PNG or JPG.', 'error')
      return
    }
    setSelectedId(j.id)
    setFiling({ jobId: j.id, file })
  }
  const onFiled = (j: JobWithDetails) => {
    const next = nextRow
    setFiling(null)
    setFiledIds((prev) => new Set([...prev, j.id]))
    dispatchJobContractChanged()
    onSent()
    setSelectedId(next?.id ?? null)
  }

  // The document as the customer gets it — draft row first (that is what the send reuses), else the prefill + the chosen terms.
  const paneHtml = useMemo(() => {
    if (!selected) return ''
    const inp = inputs.find((x) => x.id === selected.id)
    const est = accepted.get(selected.id)
    const fields: JobContractFields =
      paneEdit && paneEdit.jobId === selected.id
        ? editedFields(selected, paneEdit)
        : draftRow
          ? parseJobContractFields(draftRow.fields)
          : buildJobContractPrefill({ job: selected, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
    const bodyHtml = draftRow ? (draftRow.body_html ?? '') : template ? (template.book_body_html ?? '') : DEFAULT_JOB_CONTRACT_TERMS_PLAIN
    const bodyFormat = draftRow ? draftRow.body_format : template ? template.book_body_format : 'plain'
    const issuer = issuerReady ? getPhysicalInvoiceIssuerForDocument() : null
    return buildJobContractDocumentHtml({
      heading: jobContractHeading(selected),
      jobNumber: inp?.jobNumber ?? '—',
      jobAddress: selected.job_address ?? '',
      customerName: selected.customer_name ?? '',
      recipientName: draftRow?.recipient_name ?? selected.customer_name ?? '',
      dateLabel: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      revision: draftRow?.revision ?? 1,
      fields,
      termsHtml: renderContractBodyToSafeHtml(bodyHtml, bodyFormat),
      templateName: draftRow ? draftRow.template_name : templateName,
      issuer: issuer?.companyName ? issuer : null,
      signature: null,
    })
  }, [selected, inputs, accepted, draftRow, template, templateName, issuerReady, paneEdit, editedFields])

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

  const selState = selected ? states.get(selected.id) : undefined
  const selInput = selected ? inputs.find((x) => x.id === selected.id) : undefined
  const selEmail = selected ? emailFor(selected) : ''
  const primary = contractSweepPrimary(selState)
  const gcName = selected ? (selected.gcCustomer?.name ?? '').trim() || null : null
  const sentence = selected ? contractSweepFooterSentence({ state: selState, email: selEmail, jobName: selInput?.jobName ?? '', gcName, nextJobNumber: nextRow ? (inputs.find((x) => x.id === nextRow.id)?.jobNumber ?? null) : null }) : ''
  const busy = busyId != null || sendingAll
  const showList = !isMobile || !selected
  const showPane = !isMobile || Boolean(selected)

  const footer = sendAllArmed ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }} data-testid="sweep-send-all-confirm">
      <span>
        Email <b>{summary.customersToEmail} customer{summary.customersToEmail === 1 ? '' : 's'}</b> ({summary.toSend} agreement{summary.toSend === 1 ? '' : 's'}) with <b>{templateName}</b>? Reminders follow every 3 days, up to 3 times. Rows that need a look are skipped.
      </span>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" style={btn} disabled={sendingAll} onClick={() => setSendAllArmed(false)}>
          Cancel
        </button>
        <button type="button" style={{ ...btnPrimary, background: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' }} disabled={busy} onClick={() => void sendAll()}>
          {sendingAll ? 'Sending…' : `Confirm — send ${summary.toSend} now`}
        </button>
      </span>
    </div>
  ) : selected && filing && filing.jobId === selected.id ? (
    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="sweep-pane-footer">
      Filing replaces the send for this job — nothing goes to the customer.
    </div>
  ) : selected ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap' }} data-testid="sweep-pane-footer">
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btnGhost} disabled={busy} onClick={() => setFiling({ jobId: selected.id, file: null })} title="Already signed on paper or in a Google Doc — file it instead of sending">
          Already signed? File it
        </button>
        <button type="button" style={{ ...btnGhost, color: 'var(--text-muted)' }} disabled={busy} onClick={() => setDetail({ job: selected, filing: false })} title="Dates, exclusions, extra recipients, a message — the full Contract modal">
          Open the full editor
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: 360 }} data-testid="sweep-footer-sentence">
          {sentence}
        </span>
        <button type="button" style={btn} disabled={busy} onClick={() => setSelectedId(nextRow?.id ?? null)} title="Leave this job in the list and move on">
          Skip
        </button>
        {primary === 'file_theirs' ? (
          <>
            <button type="button" style={btn} disabled={busy} onClick={() => void sendSelected(true)} title="Send our service agreement to the builder anyway">
              Send ours instead
            </button>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => setFiling({ jobId: selected.id, file: null })}>
              File their subcontract
            </button>
          </>
        ) : primary === 'send_next' ? (
          <>
            <button type="button" style={btn} disabled={busy} onClick={() => void sendSelected(false)}>
              {busyId === selected.id ? 'Sending…' : 'Send'}
            </button>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => void sendSelected(true)}>
              {busyId === selected.id ? 'Sending…' : nextRow ? 'Send & next' : 'Send'}
            </button>
          </>
        ) : selState?.emailOk ? (
          <>
            <button type="button" style={btn} disabled={busy} onClick={() => void sendSelected(true)} title="Send it as it reads — the footer says what is unusual">
              {busyId === selected.id ? 'Sending…' : 'Send anyway'}
            </button>
            <button type="button" style={{ ...btnPrimary, opacity: 0.55, cursor: 'not-allowed' }} disabled title="Dimmed until the row is Ready — open the full editor to add the scope or an amount">
              Send &amp; next
            </button>
          </>
        ) : (
          <button type="button" style={btnPrimary} disabled={busy} onClick={() => onEditJob(selected)}>
            Fix email on the job
          </button>
        )}
      </div>
    </div>
  ) : (
    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{gapRows.length === 0 ? 'Nothing left to send.' : isMobile ? 'Tap a job to see its agreement.' : 'Pick a job on the left to see its agreement.'}</div>
  )

  return (
    <ResponsiveModalShell title="Contract sweep" onRequestClose={onClose} maxWidthDesktop={1100} headerAction={<ArHeaderMenu items={menuItems} ariaLabel="Contract sweep tools" />} footer={footer}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} data-testid="sweep-summary">
          <b style={{ color: 'var(--text-strong)' }}>{summary.all} without a contract</b> · {formatUsdNoCents(summary.revenueTotal)} of work · {summary.needsLook} need{summary.needsLook === 1 ? 's' : ''} a look
          {sentIds.size > 0 ? ` · ${sentIds.size} sent this sweep` : ''}
          {filedIds.size > 0 ? ` · ${filedIds.size} filed` : ''}
          {floorCents > 0 ? ` · under ${formatContractFloor(floorCents)} left out` : ''}
        </div>
        <div role="group" aria-label="Which rows to show" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {CONTRACT_SWEEP_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f)
                setSelectedId(null)
              }}
              style={segStyle(filter === f)}
            >
              {CONTRACT_SWEEP_FILTER_LABELS[f]} · {filterCounts[f]}
            </button>
          ))}
        </div>
      </div>
      {gapRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Every live job has an agreement on file, or doesn&apos;t need one. 🎉</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(300px, 5fr) minmax(360px, 7fr)', gap: '0.75rem', alignItems: 'start' }}>
          {showList ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: isMobile ? undefined : '68vh', overflowY: 'auto' }} data-testid="sweep-list">
              {visibleRows.length === 0 ? (
                <p style={{ margin: 0, padding: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{filter === 'to_send' ? 'Nothing is ready to send as-is — every remaining row needs a look.' : 'Nothing needs a look.'}</p>
              ) : (
                visibleRows.map((j) => {
                  const inp = inputs.find((x) => x.id === j.id)
                  const num = inp?.jobNumber ?? '—'
                  const st = states.get(j.id)
                  const amount = inp?.revenue != null && inp.revenue > 0 ? formatUsdNoCents(inp.revenue) : 'no amount'
                  const active = selected?.id === j.id
                  return (
                    <div
                      key={j.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={active}
                      onClick={() => setSelectedId(j.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(j.id)
                        }
                      }}
                      data-testid="sweep-row"
                      data-job={num}
                      onDragOver={(e) => {
                        if (e.dataTransfer?.types?.includes('Files')) {
                          e.preventDefault()
                          if (dragOverId !== j.id) setDragOverId(j.id)
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverId === j.id) setDragOverId(null)
                      }}
                      onDrop={(e) => {
                        if (!e.dataTransfer?.files?.length) return
                        e.preventDefault()
                        acceptDroppedFile(j, e.dataTransfer.files[0] ?? null)
                      }}
                      title="Drop a PDF or photo of the signed contract here to file it"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: '0.1rem 0.75rem',
                        alignItems: 'center',
                        padding: '0.45rem 0.6rem',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        background: dragOverId === j.id ? 'var(--bg-blue-tint)' : active ? 'var(--bg-blue-tint)' : 'transparent',
                        boxShadow: active ? 'inset 3px 0 0 var(--text-link)' : undefined,
                        outline: dragOverId === j.id ? '2px dashed var(--text-link)' : undefined,
                        outlineOffset: -3,
                        position: 'relative',
                      }}
                    >
                      {dragOverId === j.id ? (
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-link)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', pointerEvents: 'none' }}>
                          Drop to file as the signed copy
                        </span>
                      ) : null}
                      <div style={{ minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>J{num}</span> · {(j.job_name ?? '').trim() || 'Job'}
                        {(j.customer_name ?? '').trim() ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {(j.customer_name ?? '').trim()}</span> : null}
                      </div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: inp?.revenue ? 'inherit' : 'var(--text-faint)' }}>{amount}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(j.job_address ?? '').trim() || '—'} · {STATUS_LABEL[j.status ?? ''] ?? j.status}
                        {inp?.email ? ` · ${inp.email}` : ' · no email on the job'}
                      </div>
                      <div style={{ textAlign: 'right' }}>{st ? <SweepRowChips state={st} /> : null}</div>
                    </div>
                  )
                })
              )}
            </div>
          ) : null}
          {showPane && selected ? (
            <div style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }} data-testid="sweep-pane">
              {isMobile ? (
                <button type="button" style={{ ...btnGhost, justifySelf: 'start' }} onClick={() => setSelectedId(null)}>
                  ← Back to the list
                </button>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '0.4rem 0.6rem', alignItems: 'center' }}>
                <span style={kLabel}>To</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
                  <input
                    style={{ ...input, ...(selEmail && !selState?.emailOk ? { borderColor: 'var(--text-red-700)' } : {}) }}
                    type="email"
                    value={selEmail}
                    placeholder="no email on the job"
                    onChange={(e) => setEmails((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                    aria-label={`Signer email for job ${selInput?.jobNumber ?? ''}`}
                    disabled={Boolean(draftRow && draftRow.status === 'sent')}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{(selected.customer_name ?? '').trim() || ''}</span>
                </div>
                <span style={kLabel}>Terms</span>
                {draftRow ? (
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {draftRow.template_name ?? 'Contract'} · {draftRow.status === 'sent' ? 'sent' : 'draft saved'} {formatContractStamp(draftRow.last_sent_at ?? draftRow.updated_at ?? draftRow.created_at) ?? ''} — the send reuses this draft as it reads; change it in the full editor
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...input, width: 'auto', minWidth: 220 }} aria-label="Terms for every job in this sweep">
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.document_name}
                        </option>
                      ))}
                      <option value={BUILTIN}>Built-in service agreement terms</option>
                    </select>
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>applies to every job in this sweep</span>
                  </div>
                )}
              </div>
              {filing && filing.jobId === selected.id ? (
                <JobContractFileSheet
                  key={`${selected.id}:${filing.file?.name ?? ''}`}
                  layout="inline"
                  inlineTitle={selState?.flags.includes('gc_job') && gcName ? `File ${gcName}'s subcontract` : 'File a signed contract'}
                  jobId={selected.id}
                  defaultSignerName={(selected.customer_name ?? '').trim()}
                  existingDraft={draftRow && draftRow.status === 'draft' ? draftRow : null}
                  basePayload={buildJobContractDraftPayload({
                    jobId: selected.id,
                    fields: paneEdit && paneEdit.jobId === selected.id ? editedFields(selected, paneEdit) : buildJobContractPrefill({ job: selected }),
                    template,
                    recipientName: (selected.customer_name ?? '').trim(),
                    recipientEmail: selEmail,
                    recipientPhone: selected.customer_phone ?? null,
                  })}
                  initialFile={filing.file}
                  onFiled={() => onFiled(selected)}
                  onCancel={() => setFiling(null)}
                />
              ) : null}
              {paneEdit && paneEdit.jobId === selected.id && !(filing && filing.jobId === selected.id) ? (
                <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '0.4rem 0.6rem', alignItems: 'start' }} data-testid="sweep-pane-edit">
                  <span style={{ ...kLabel, paddingTop: 6 }}>Scope</span>
                  <textarea
                    style={{ ...input, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
                    value={paneEdit.scopeText}
                    disabled={Boolean(draftRow && draftRow.status === 'sent')}
                    onChange={(e) => setPaneEdit((prev) => (prev ? { ...prev, scopeText: e.target.value, dirty: true } : prev))}
                    placeholder="One line per item — what you'll do, in the customer's words"
                    aria-label="Scope — one line per item"
                  />
                  <span style={kLabel}>Amount</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      style={{ ...input, maxWidth: 140 }}
                      inputMode="decimal"
                      value={paneEdit.amountText}
                      disabled={Boolean(draftRow && draftRow.status === 'sent')}
                      onChange={(e) => setPaneEdit((prev) => (prev ? { ...prev, amountText: e.target.value, dirty: true } : prev))}
                      placeholder="Blank = time and materials"
                      aria-label="Contract amount"
                    />
                    <span style={{ fontSize: '0.7rem', color: saveState === 'error' ? 'var(--text-red-700)' : 'var(--text-faint)' }} data-testid="sweep-save-state">
                      {draftRow && draftRow.status === 'sent' ? 'Locked — sent; Void & redo in the full editor' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved to the job’s draft' : saveState === 'error' ? 'Save failed' : 'Edits save to the job’s draft as you type'}
                    </span>
                  </div>
                </div>
              ) : null}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', opacity: filing && filing.jobId === selected.id ? 0.45 : 1 }}>
                <iframe title="The agreement as the customer will see it" srcDoc={paneHtml} sandbox="" style={{ width: '100%', height: isMobile ? '60vh' : '54vh', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', display: 'block' }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '0.3rem' }}>Exactly what the signing page and the PDF will show{draftRow ? '' : ' — from the job’s fixtures or its accepted estimate, and the terms above'}.</div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <JobContractModal
        open={detail != null}
        onClose={() => {
          setDetail(null)
          // The modal may have autosaved a draft or filed a copy — re-read the selected job's row and the edit fields.
          setDraft(null)
          setPaneEdit(null)
        }}
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
