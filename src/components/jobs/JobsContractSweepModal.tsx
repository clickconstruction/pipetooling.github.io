/**
 * The contract sweep (Contract Desk PR 4 → Contract sweep PR 1 / PR 2): every
 * live job with nothing on file as a queue on the left, wearing the state the
 * app already knows (`contractSweepRowState.ts`), and the selected job's
 * agreement on the right, rendered from the same fields the send will mint —
 * nothing sends unseen. The footer says what the button will do and which
 * job comes next. Signing it on paper PR 5 (v2.3644): the pane asks *How this
 * one gets signed* — the PDF to sign by hand, a signing link, download to
 * print, or a builder's own subcontract — pre-picked per row
 * (`contractSigningWays.ts`), and the footer's buttons follow the pick; the
 * *& next* button is the fast path. Send all lives under ⋯, takes
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
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { quickSendJobContract, type QuickSendTemplate } from '../../lib/jobs/jobContractQuickSend'
import { isContractGap, type JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { formatContractFloor } from '../../lib/jobs/jobContractFloor'
import { buildJobContractDocumentHtml, buildJobContractPrefill, DEFAULT_JOB_CONTRACT_TERMS_PLAIN, formatContractMoney, jobContractHeading, parseJobContractFields, PAYMENT_TERMS_PRESETS, type EstimateLineForPrefill, type JobContractFields, type PaymentTermsKey } from '../../lib/jobs/jobContractDocument'
import { contractAmountDoorLabel, contractAmountDrift, contractAmountSource, contractAmountSourceLabel } from '../../lib/jobs/contractAmountSource'
import { formatContractStamp, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { buildJobContractDraftPayload, saveJobContractDraft } from '../../lib/jobs/jobContractDraftWrite'
import { fetchContractDraftPdf, saveBytesAsFile } from '../../lib/jobs/contractDraftPdf'
import { dispatchJobContractChanged } from '../../lib/jobs/jobContractNotNeeded'
import JobContractFileSheet from './JobContractFileSheet'
import StandardTermsEditModal from './StandardTermsEditModal'
import { standardTermsLabel } from '../../lib/jobs/standardTerms'
import { effectiveSigningWay, signingWayButtons, signingWayDetailLine, signingWaysForRow, type SigningWay, type SigningWayOption } from '../../lib/jobs/contractSigningWays'
import { handoffBlocker, isAwaitingPaperCopy, markJobContractHanded } from '../../lib/jobs/jobContractHandoff'
import DriveContractsFoundModal, { driveMatchJobFrom } from './DriveContractsFoundModal'
import { matchDriveContracts, type DriveScanFile } from '../../lib/jobs/driveContractMatch'
import { sweepDriveScanCache } from '../../lib/jobs/driveContractScanCache'
import { bestDriveFindByJob, defaultSweepDoor, driveFindChip, driveFindPrefills, type DriveFind } from '../../lib/jobs/contractSweepDrive'

/** The kernel's three filters, plus the Drive pass's own tab (shown only when it found something). */
type SweepFilter = ContractSweepFilter | 'in_drive'

/** Who sees ⋯ → Look in Drive: the office set, mirroring `officeRoles` in `supabase/functions/drive-contract-scan`. */
const DRIVE_PASS_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import {
  assessContractSweepRows,
  contractSweepFilterMatches,
  contractSweepFooterSentence,
  contractSweepHeaderClauses,
  contractSweepSummary,
  CONTRACT_SWEEP_FILTER_LABELS,
  CONTRACT_SWEEP_FILTER_TITLES,
  CONTRACT_SWEEP_FILTERS,
  CONTRACT_SWEEP_FLAG_LABELS,
  type ContractSweepFilter,
  type ContractSweepRowInput,
  type ContractSweepRowState,
} from '../../lib/jobs/contractSweepRowState'
import { ArHeaderMenu } from './ar/ArHeaderMenu'
import JobContractModal from './JobContractModal'

type TemplateRow = NonNullable<QuickSendTemplate>
type AcceptedEstimate = { lines: EstimateLineForPrefill[]; totalCents: number | null; acceptedOn: string | null }

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
/** A tab on the list (v2.3703): the filter sits on what it filters, each count once, in a pill. */
function tabStyle(active: boolean): CSSProperties {
  return {
    flex: '1 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '0.45rem 0.4rem',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--text-link)' : 'transparent'}`,
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text-strong)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontWeight: active ? 700 : 500,
    font: 'inherit',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  }
}
function tabCountStyle(active: boolean): CSSProperties {
  return { fontSize: '0.66rem', fontWeight: 700, padding: '0 6px', borderRadius: 999, background: active ? 'var(--bg-blue-tint)' : 'var(--bg-muted)', color: active ? 'var(--text-link)' : 'var(--text-muted)' }
}
/** Wide enough for "STANDARD TERMS" on one line — at 56px it wrapped into its own value. */
const PANE_LABEL_COL = 74
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

/** The Drive pass's mark on a row: green when the matcher is sure, amber when a person should look. */
function DriveFindChip({ find }: { find: DriveFind }) {
  const c = driveFindChip(find)
  return (
    <span style={chipStyle(c.tone)} title={c.title} data-testid="sweep-drive-chip">
      {c.text}
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
  const { user: authUser, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const isMobile = useIsMobile()
  /** The Drive pass (v2.3390): dev-run first; open to the office set since v2.3587 (the same roles `drive-contract-scan` admits). */
  const [driveOpen, setDriveOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templateId, setTemplateId] = useState(BUILTIN)
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(() => new Set())
  const [sendAllArmed, setSendAllArmed] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)
  const [detail, setDetail] = useState<{ job: JobWithDetails; filing: boolean } | null>(null)
  const [filter, setFilter] = useState<SweepFilter>('to_send')
  /** The Drive pass (refresh, to-dos/contract-sweep-refresh): contract-looking files in the jobs Drive, read once per open. Null = not read (yet, or not allowed). */
  const [driveFiles, setDriveFiles] = useState<DriveScanFile[] | null>(null)
  const [driveChecking, setDriveChecking] = useState(false)
  /** "Check" finds the person opened and chose to use — only then is the link filled in (driveFindPrefills). */
  const [acceptedFinds, setAcceptedFinds] = useState<ReadonlySet<string>>(() => new Set())
  const [accepted, setAccepted] = useState<ReadonlyMap<string, AcceptedEstimate>>(() => new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** The selected job's live draft/sent row, when it has one — the send reuses it, so the pane shows it (PR 2). */
  const [draft, setDraft] = useState<{ jobId: string; row: JobContractRow | null } | null>(null)
  const [issuerReady, setIssuerReady] = useState(false)
  /** PR 3: what the office typed for the selected job — scope one line per item (the amount is the job's, v2.3707). */
  const [paneEdit, setPaneEdit] = useState<{ jobId: string; scopeText: string; paymentKey: PaymentTermsKey; paymentText: string; dirty: boolean } | null>(null)
  /** Saved edits per job, so the row's chips follow what was typed after the selection moves on. */
  const [overrides, setOverrides] = useState<Record<string, { scopeLines: string[] }>>({})
  /** v2.3707: every job's live draft amount (null = the draft says time and materials), so a row can say its draft differs from the job. */
  const [draftAmounts, setDraftAmounts] = useState<ReadonlyMap<string, number | null>>(() => new Map())
  /** Jobs whose draft the office told to take the job's number (Use the job's $…). */
  const [useJobAmount, setUseJobAmount] = useState<ReadonlySet<string>>(() => new Set())
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
    setDriveFiles(null)
    setDriveChecking(false)
    setAcceptedFinds(new Set())
    setSelectedId(null)
    setDraft(null)
    setPaneEdit(null)
    setOverrides({})
    setDraftAmounts(new Map())
    setUseJobAmount(new Set())
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
    // The Drive pass, quietly: it only ever pre-fills a link for a person to check, so a failure
    // (no Drive access, a slow scan) just leaves the sweep as it was.
    let driveCancelled = false
    if (DRIVE_PASS_ROLES.has(authRole ?? '')) {
      setDriveChecking(true)
      void sweepDriveScanCache.get().then((files) => {
        if (driveCancelled) return
        setDriveChecking(false)
        if (files) setDriveFiles(files)
      })
    }
    void fetchPhysicalInvoiceIssuerFromAppSettings()
      .catch(() => undefined)
      .then(() => setIssuerReady(true))
    return () => {
      driveCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per open, as before; the role does not change while the sweep is up
  }, [open])
  const gapIdsKey = gapRows.map((j) => j.id).join(',')
  useEffect(() => {
    if (!open || !gapIdsKey) return
    let cancelled = false
    void (async () => {
      const ids = gapIdsKey.split(',')
      const next = new Map<string, AcceptedEstimate>()
      const drafts = new Map<string, number | null>()
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150)
        const { data } = await supabase.from('estimates').select('job_ledger_id, line_items_snapshot, total_cents, acceptor_consented_at').eq('status', 'customer_accepted').in('job_ledger_id', chunk)
        for (const row of (data ?? []) as { job_ledger_id: string | null; line_items_snapshot: unknown; total_cents: number | null; acceptor_consented_at: string | null }[]) {
          if (!row.job_ledger_id || next.has(row.job_ledger_id)) continue
          next.set(row.job_ledger_id, {
            lines: normalizeEstimateLineItemsFromJson(row.line_items_snapshot).map((l) => ({ line_item: l.line_item, description: l.description, quantity: l.quantity })),
            totalCents: row.total_cents,
            acceptedOn: row.acceptor_consented_at,
          })
        }
        // v2.3707: each job's live draft, so a row can say when its draft carries a number other than the job's.
        const { data: draftRows } = await supabase.from('job_contracts').select('job_id, fields, created_at').in('status', ['draft', 'sent']).is('voided_at', null).in('job_id', chunk).order('created_at', { ascending: false })
        for (const row of (draftRows ?? []) as { job_id: string; fields: unknown }[]) {
          if (drafts.has(row.job_id)) continue
          drafts.set(row.job_id, parseJobContractFields(row.fields).amount_cents)
        }
      }
      if (!cancelled) {
        setAccepted(next)
        setDraftAmounts(drafts)
      }
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
        // v2.3707: the amount is the job's number; a draft's own number only ever shows up as "differs".
        const src = contractAmountSource({ job: j, acceptedTotalCents: est?.totalCents ?? null, acceptedOn: est?.acceptedOn ?? null })
        return {
          id: j.id,
          jobNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
          jobName: (j.job_name ?? '').trim(),
          email: emailFor(j),
          revenue: src.cents != null ? src.cents / 100 : null,
          scopeLines: ov ? ov.scopeLines : fields.scope_lines,
          gcJob: sweepRowIsGcJob(j),
          draftAmountCents: useJobAmount.has(j.id) ? src.cents : draftAmounts.has(j.id) ? draftAmounts.get(j.id) : undefined,
        }
      }),
    [gapRows, accepted, emailFor, overrides, draftAmounts, useJobAmount],
  )
  const states = useMemo(() => assessContractSweepRows(inputs), [inputs])
  const summary = useMemo(() => contractSweepSummary(inputs, states), [inputs, states])
  // The selected row stays on screen even when an edit moves it out of the filter (a thin row that became Ready) — it leaves when the selection moves on.
  /** One best Drive find per job still in the pile. */
  const driveFinds = useMemo<ReadonlyMap<string, DriveFind>>(
    () => (driveFiles ? bestDriveFindByJob(matchDriveContracts(driveFiles, gapRows.map(driveMatchJobFrom))) : new Map()),
    [driveFiles, gapRows],
  )
  const visibleRows = useMemo(
    () => gapRows.filter((j) => j.id === selectedId || (filter === 'in_drive' ? driveFinds.has(j.id) : contractSweepFilterMatches(states.get(j.id), filter))),
    [gapRows, states, filter, selectedId, driveFinds],
  )
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
  // The first question first: a row the Drive pass found a contract for, or a builder's row (their
  // paper, not ours), opens on "We already have one"; every other row opens on sending. A file
  // dropped on a row has already opened that door, so it is left alone.
  const selectedJobId = selected?.id ?? null
  const selectedHasFind = selectedJobId != null && driveFinds.has(selectedJobId)
  const selectedIsGc = selectedJobId != null && Boolean(states.get(selectedJobId)?.flags.includes('gc_job'))
  useEffect(() => {
    if (!open || !selectedJobId) return
    const door = defaultSweepDoor({ find: selectedHasFind ? driveFinds.get(selectedJobId) : undefined, isGcRow: selectedIsGc })
    setFiling((prev) => (prev && prev.jobId === selectedJobId ? prev : door === 'have' ? { jobId: selectedJobId, file: null } : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the job and whether it has a find; the map's identity changes with every list change
  }, [open, selectedJobId, selectedHasFind, selectedIsGc])
  const draftRow = draft && selected && draft.jobId === selected.id ? draft.row : null
  const draftKnown = Boolean(draft && selected && draft.jobId === selected.id)

  // PR 3: once the selected job's draft is known, the edit fields start from it (or the prefill).
  useEffect(() => {
    if (!open || !selected || !draftKnown) return
    if (paneEdit && paneEdit.jobId === selected.id) return
    const est = accepted.get(selected.id)
    const f = draftRow ? parseJobContractFields(draftRow.fields) : buildJobContractPrefill({ job: selected, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
    setPaneEdit({ jobId: selected.id, scopeText: f.scope_lines.join('\n'), paymentKey: f.payment_terms_key, paymentText: f.payment_terms_text ?? '', dirty: false })
    setSaveState(draftRow ? 'saved' : 'idle')
    if (draftRow) {
      setOverrides((prev) => (prev[selected.id] ? prev : { ...prev, [selected.id]: { scopeLines: f.scope_lines } }))
      setDraftAmounts((prev) => (prev.get(selected.id) === f.amount_cents ? prev : new Map(prev).set(selected.id, f.amount_cents)))
    }
  }, [open, selected, draftKnown, draftRow, accepted, paneEdit])

  const editedFields = useCallback(
    (job: JobWithDetails, edit: { scopeText: string; paymentKey?: PaymentTermsKey; paymentText?: string }): JobContractFields => {
      const est = accepted.get(job.id)
      const base = draftRow && draftRow.job_id === job.id ? parseJobContractFields(draftRow.fields) : buildJobContractPrefill({ job, estimateLines: est?.lines ?? [], acceptedTotalCents: est?.totalCents ?? null })
      return {
        ...base,
        scope_lines: edit.scopeText.split('\n').map((l) => l.trim()).filter(Boolean),
        // v2.3707: the job's number — a draft keeps what it carries until Use the job's $… says otherwise (named, never rewritten in silence).
        amount_cents: useJobAmount.has(job.id) ? contractAmountSource({ job, acceptedTotalCents: est?.totalCents ?? null }).cents : base.amount_cents,
        // PR 4 (v2.3642): the payment line is this job's, editable here — it used to need the full editor.
        ...(edit.paymentKey ? { payment_terms_key: edit.paymentKey, payment_terms_text: edit.paymentKey === 'custom' ? (edit.paymentText ?? '') : base.payment_terms_text } : {}),
      }
    },
    [accepted, draftRow, useJobAmount],
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
      setOverrides((prev) => ({ ...prev, [selected.id]: { scopeLines: fields.scope_lines } }))
      setDraftAmounts((prev) => new Map(prev).set(selected.id, fields.amount_cents))
      setPaneEdit((prev) => (prev && prev.jobId === selected.id ? { ...prev, dirty: false } : prev))
      setSaveState('saved')
      return row
    } catch {
      setSaveState('error')
      return null
    }
  }, [selected, paneEdit, draftRow, editedFields, template, emailFor, authUser?.id])
  /**
   * Download PDF (Signing it on paper PR 1, v2.3527): the agreement as the pane shows it,
   * unsigned, for a customer who signs on paper. Built from the pane's own fields and the
   * chosen terms — no row is written, nothing is sent.
   */
  const [pdfBusy, setPdfBusy] = useState(false)
  /** PR 5 (v2.3644): the way picked per job (absent = the row's default), and the builder rows whose *Send ours anyway* is open. */
  const [wayByJob, setWayByJob] = useState<Record<string, SigningWay>>({})
  const [oursOpenFor, setOursOpenFor] = useState<string | null>(null)
  /** PR 4: the Edit standard terms window. */
  const [termsEditOpen, setTermsEditOpen] = useState(false)
  const [handBusy, setHandBusy] = useState(false)
  const downloadPdf = useCallback(async (quiet = false): Promise<boolean> => {
    if (!selected || pdfBusy) return false
    setPdfBusy(true)
    try {
      const fields = paneEdit && paneEdit.jobId === selected.id ? editedFields(selected, paneEdit) : null
      const payload = buildJobContractDraftPayload({
        jobId: selected.id,
        fields: fields ?? (draftRow ? parseJobContractFields(draftRow.fields) : editedFields(selected, { scopeText: '' })),
        template,
        recipientName: draftRow?.recipient_name ?? (selected.customer_name ?? '').trim(),
        recipientEmail: emailFor(selected),
        recipientPhone: null,
      })
      const { filename, bytes } = await fetchContractDraftPdf({
        jobId: selected.id,
        draft: {
          fields: payload.fields,
          body_html: draftRow?.body_html ?? payload.body_html ?? null,
          body_format: draftRow?.body_format ?? payload.body_format ?? 'plain',
          template_name: draftRow?.template_name ?? payload.template_name ?? null,
          recipient_name: payload.recipient_name ?? null,
          revision: draftRow?.revision ?? 1,
        },
      })
      saveBytesAsFile(bytes, filename)
      if (!quiet) showToast('PDF downloaded to look at — nothing was sent or recorded.', 'success')
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the PDF.', 'error')
      return false
    } finally {
      setPdfBusy(false)
    }
  }, [selected, pdfBusy, paneEdit, editedFields, draftRow, template, emailFor, showToast])
  /**
   * Mark as handed to the customer (PR 2): the draft becomes sent with sent_channel 'handed' —
   * a hand-off counts as asked, so the job leaves the pile and waits for the signed page.
   * Saves the pane's draft first (a job with no draft yet gets one), exactly as the send does.
   */
  const markHanded = async (andNext: boolean) => {
    if (!selected || handBusy) return
    const next = nextRow
    setHandBusy(true)
    try {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      let row = draftRow
      if (!row || paneEdit?.dirty) {
        const fields = paneEdit && paneEdit.jobId === selected.id ? editedFields(selected, paneEdit) : editedFields(selected, { scopeText: '' })
        row = await saveJobContractDraft({
          existing: draftRow,
          payload: buildJobContractDraftPayload({ jobId: selected.id, fields, template, recipientName: (selected.customer_name ?? '').trim(), recipientEmail: emailFor(selected), recipientPhone: selected.customer_phone ?? null }),
          authUserId: authUser?.id ?? null,
        })
      }
      const blocker = handoffBlocker(row)
      if (blocker || !row) {
        showToast(blocker ?? 'Could not save the agreement.', 'error')
        return
      }
      const handed = await markJobContractHanded({ row, authUserId: authUser?.id ?? null })
      if (!handed) {
        showToast('Could not record the hand-off — the agreement may already be out.', 'error')
        return
      }
      setSentIds((prev) => new Set([...prev, selected.id]))
      showToast('Downloaded and marked as handed over — it waits for the signed copy. File it from the job when it comes back.', 'success')
      onSent()
      setSelectedId(andNext ? (next?.id ?? null) : isMobile ? null : (next?.id ?? null))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not record the hand-off.', 'error')
    } finally {
      setHandBusy(false)
    }
  }
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

  const sendOne = async (j: JobWithDetails, channel: 'link' | 'pdf_email' = 'link'): Promise<boolean> => {
    setBusyId(j.id)
    try {
      const est = accepted.get(j.id)
      const res = await quickSendJobContract({
        job: j,
        template,
        recipientEmail: emailFor(j),
        recipientName: (j.customer_name ?? '').trim(),
        authUserId: authUser?.id ?? null,
        channel,
        estimateLines: est?.lines ?? [],
        acceptedTotalCents: est?.totalCents ?? null,
      })
      if (!res.ok) {
        showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: ${res.error}`, 'error')
        return false
      }
      setSentIds((prev) => new Set([...prev, j.id]))
      if (!res.emailed) showToast(`${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}: link minted but the email did not send.`, 'error')
      else if (channel === 'pdf_email') showToast(`PDF emailed to ${emailFor(j)} to sign by hand — file the signed copy when it comes back.`, 'success')
      return true
    } finally {
      setBusyId(null)
    }
  }

  /** Send the selected job; with `andNext` the selection lands on the row that followed it. */
  const sendSelected = async (andNext: boolean, channel: 'link' | 'pdf_email' = 'link') => {
    if (!selected) return
    const next = nextRow
    // v2.3631: the PDF goes to a customer as an attachment — say to whom before it does.
    if (channel === 'pdf_email') {
      const ok = await confirmDialog({
        title: 'Email the PDF to sign by hand?',
        message: `${emailFor(selected)} gets the agreement as a PDF to print, sign and send back, with the signing link as a second way. The job leaves this list and waits for the signed copy.`,
        confirmLabel: 'Yes, email it',
      })
      if (!ok) return
    }
    if (paneEdit?.dirty) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      const row = await flushPaneEdit()
      if (!row && saveState === 'error') return
    }
    const sent = await sendOne(selected, channel)
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

  const inDriveCount = gapRows.filter((j) => driveFinds.has(j.id)).length
  const filterCounts: Record<SweepFilter, number> = { in_drive: inDriveCount, to_send: summary.toSend, needs_look: summary.needsLook, all: summary.all }
  // The tabs sit on the list (v2.3703); the In Drive one appears only once the pass found something.
  const shownFilters: SweepFilter[] = inDriveCount > 0 ? ['in_drive', ...CONTRACT_SWEEP_FILTERS] : [...CONTRACT_SWEEP_FILTERS]
  const filterLabel = (f: SweepFilter) => (f === 'in_drive' ? '📄 In Drive' : CONTRACT_SWEEP_FILTER_LABELS[f])
  const filterTitle = (f: SweepFilter) => (f === 'in_drive' ? 'The Drive pass found paper that may already be the contract — check it, then file it' : CONTRACT_SWEEP_FILTER_TITLES[f])
  const header = contractSweepHeaderClauses({ all: summary.all, revenueTotal: summary.revenueTotal, sent: sentIds.size, filed: filedIds.size, floorLabel: floorCents > 0 ? formatContractFloor(floorCents) : '', formatMoney: formatUsdNoCents })
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
    ...(DRIVE_PASS_ROLES.has(authRole ?? '') && gapRows.length > 0
      ? [{ key: 'drive', label: 'Look in Drive for signed contracts…', hint: 'The jobs Shared Drive — file what is already signed, nobody is emailed', onSelect: () => setDriveOpen(true) }]
      : []),
  ]

  const selState = selected ? states.get(selected.id) : undefined
  const selInput = selected ? inputs.find((x) => x.id === selected.id) : undefined
  /** The Drive pass's find for the selected job, and whether the pane is on the "We already have one" door. */
  const selFind = selected ? driveFinds.get(selected.id) : undefined
  const paneFiling = Boolean(selected && filing && filing.jobId === selected.id)
  const selFindPrefills = driveFindPrefills(selFind, selected != null && acceptedFinds.has(selected.id))
  const selEmail = selected ? emailFor(selected) : ''
  const gcName = selected ? (selected.gcCustomer?.name ?? '').trim() || null : null
  // v2.3707: the amount is the job's number, read out with its source; a draft that says otherwise is named.
  const selEst = selected ? accepted.get(selected.id) : undefined
  const selSrc = contractAmountSource({ job: selected ?? { revenue: null }, acceptedTotalCents: selEst?.totalCents ?? null, acceptedOn: selEst?.acceptedOn ?? null })
  const selDrift = selected ? contractAmountDrift(selSrc, selInput?.draftAmountCents) : null
  const amountDiffers = selDrift ? { draft: selDrift.draftCents != null ? formatContractMoney(selDrift.draftCents) : 'time and materials', job: selSrc.cents != null ? formatContractMoney(selSrc.cents) : 'no amount' } : undefined
  const fmtAcceptedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  // PR 5: how this one gets signed — the row's default, or the office's pick.
  const waysPlan = signingWaysForRow(selState, gcName)
  const way = effectiveSigningWay(waysPlan, selected ? wayByJob[selected.id] : null)
  const wayButtons = signingWayButtons(way, Boolean(nextRow))
  const alreadyOut = Boolean(draftRow && draftRow.status === 'sent')
  const wayBusy = Boolean(selected && busyId === selected.id) || handBusy || (way === 'download' && pdfBusy)
  /** The "& next" fast path is the primary when a row follows and this one is Ready (for Download, when its scope is more than one line). */
  const fastPath = Boolean(wayButtons.andNextLabel) && way !== 'file_theirs' && !selState?.flags.includes('amount_differs') && Boolean(selState?.readyForBulk || (way === 'download' && !selState?.flags.includes('thin_scope')))
  const sentence = selected ? contractSweepFooterSentence({ state: selState, email: selEmail, jobName: selInput?.jobName ?? '', gcName, way, nextJobNumber: nextRow ? (inputs.find((x) => x.id === nextRow.id)?.jobNumber ?? null) : null, amountDiffers }) : ''
  /** A draft carrying the wrong number stops every way of sending ours until Use the job's $… puts it right. */
  const amountBlocks = Boolean(selState?.flags.includes('amount_differs')) && way !== 'file_theirs'
  const wayLine = signingWayDetailLine(waysPlan, way)
  /**
   * One segment in the row of ways (v2.3706): a label wrapping a radio the eye never sees — the
   * radio keeps the group's semantics (the render test picks ways by role), the label wears the pick.
   */
  const renderWay = (o: SigningWayOption, i: number) => {
    if (!selected) return null
    const on = o.way === way
    return (
      <label
        key={o.way}
        title={o.disabledReason ?? o.detail}
        style={{
          flex: '1 1 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: isMobile ? '0.45rem 0.4rem' : '0.45rem 0.5rem',
          borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)',
          background: on ? 'var(--surface)' : 'var(--bg-subtle)',
          color: on ? 'var(--text-strong)' : 'var(--text-muted)',
          boxShadow: on ? 'inset 0 -3px 0 var(--text-link)' : 'none',
          fontSize: '0.78rem',
          fontWeight: on ? 700 : 600,
          cursor: o.disabledReason ? 'not-allowed' : 'pointer',
          opacity: o.disabledReason ? 0.5 : 1,
          minWidth: 0,
        }}
      >
        <input
          type="radio"
          name={`signing-way-${selected.id}`}
          checked={on}
          disabled={Boolean(o.disabledReason)}
          onChange={() => setWayByJob((prev) => ({ ...prev, [selected.id]: o.way }))}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0, pointerEvents: 'none' }}
        />
        {o.label}
      </label>
    )
  }
  const waysRow = (options: SigningWayOption[], ariaLabel: string) => (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden' }}>
      {options.map(renderWay)}
    </div>
  )
  const goWay = async (andNext: boolean) => {
    if (!selected) return
    if (way === 'pdf_email') return sendSelected(andNext, 'pdf_email')
    if (way === 'link') return sendSelected(andNext, 'link')
    if (way === 'download') {
      // The page first; the stamp only when there is a page in hand.
      const ok = await downloadPdf(true)
      if (ok) await markHanded(andNext)
    }
  }
  
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="sweep-pane-footer">
      <span>Filing replaces the send for this job — nothing goes to the customer.</span>
      <button type="button" style={btn} disabled={busy} onClick={() => setSelectedId(nextRow?.id ?? null)} title="Leave this job in the list and move on">
        Skip
      </button>
    </div>
  ) : selected ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap' }} data-testid="sweep-pane-footer">
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...btnGhost, color: 'var(--text-muted)' }}
          disabled={busy || pdfBusy}
          onClick={() => void downloadPdf()}
          title="The agreement as it reads right now, with blank Sign and Date rules for a pen — to look at; nothing is sent or recorded"
          data-testid="sweep-download-pdf"
        >
          {pdfBusy ? 'Building…' : 'Preview PDF'}
        </button>
        {selState && !selState.emailOk && way !== 'file_theirs' ? (
          <button type="button" style={btnGhost} disabled={busy} onClick={() => onEditJob(selected)} title="Put the signer's email on the job itself, so it is there next time — or type it in To above for this agreement only" data-testid="sweep-fix-email">
            Fix email on the job
          </button>
        ) : null}
        {/* v2.3706: the rest of the left side lives under ⋯ More — the full editor, and the one-job send while the fast path is the primary. */}
        <ArHeaderMenu
          ariaLabel="More for this job"
          label="More"
          openUp
          align="left"
          items={[
            ...(fastPath && !alreadyOut
              ? [{ key: 'one-job', label: `${wayButtons.label} — stay on this job`, hint: nextRow ? `The same as the blue button, without moving on to J${inputs.find((x) => x.id === nextRow.id)?.jobNumber ?? ''}` : undefined, onSelect: () => void goWay(false) }]
              : []),
            { key: 'full-editor', label: 'Open the full editor', hint: 'Dates, exclusions, extra recipients, a message — the full Contract window', onSelect: () => setDetail({ job: selected, filing: false }) },
          ]}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: 360 }} data-testid="sweep-footer-sentence">
          {sentence}
        </span>
        <button type="button" style={btn} disabled={busy} onClick={() => setSelectedId(nextRow?.id ?? null)} title="Leave this job in the list and move on">
          Skip
        </button>
        {way === 'file_theirs' ? (
          <button type="button" style={btnPrimary} disabled={busy} onClick={() => setFiling({ jobId: selected.id, file: null })} data-testid="sweep-way-go">
            {wayButtons.label}
          </button>
        ) : alreadyOut ? (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Already out — file the signed copy when it comes back</span>
        ) : fastPath ? (
          // One primary (v2.3706): the fast path when the row is Ready and another follows — the one-job send is under ⋯ More.
          <button type="button" style={btnPrimary} disabled={busy || handBusy || pdfBusy} onClick={() => void goWay(true)} data-testid="sweep-way-go-next">
            {wayBusy ? wayButtons.busyLabel : wayButtons.andNextLabel}
          </button>
        ) : (
          // …else the one-job send itself: on a row that is not Ready it goes as it reads, and the sentence says what is unusual —
          // except a draft carrying the wrong number (v2.3707), which waits for Use the job's $… above.
          <button
            type="button"
            style={amountBlocks ? { ...btnPrimary, opacity: 0.55, cursor: 'not-allowed' } : btnPrimary}
            disabled={busy || handBusy || pdfBusy || amountBlocks}
            onClick={() => void goWay(false)}
            title={amountBlocks ? "Waits until the draft carries the job's number — press Use the job's number above" : selState?.readyForBulk || way === 'download' ? undefined : 'Goes as it reads — the line to the left says what is unusual'}
            data-testid="sweep-way-go"
          >
            {wayBusy ? wayButtons.busyLabel : wayButtons.label}
          </button>
        )}
      </div>
    </div>
  ) : (
    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{gapRows.length === 0 ? 'Nothing left to send.' : isMobile ? 'Tap a job to see its agreement.' : 'Pick a job on the left to see its agreement.'}</div>
  )

  return (
    <ResponsiveModalShell title="Contract sweep" onRequestClose={onClose} maxWidthDesktop={1100} headerAction={<ArHeaderMenu items={menuItems} ariaLabel="Contract sweep tools" />} footer={footer}>
      {/* The header says only what the tabs cannot (v2.3703): the dollars, this sitting's sends and filings, the floor, and the Drive pass while it runs. */}
      {gapRows.length > 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }} data-testid="sweep-summary">
          <b style={{ color: 'var(--text-strong)' }}>{header.lead}</b> has no contract on file
          {header.rest.map((clause) => ` · ${clause}`).join('')}
          {driveChecking && inDriveCount === 0 ? <span style={{ color: 'var(--text-faint)' }} data-testid="sweep-drive-checking" title="Looking through the jobs Drive for contracts these customers already signed — it takes a minute, and you can work meanwhile"> · 📄 checking Drive…</span> : null}
        </div>
      ) : null}
      {gapRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Every live job has an agreement on file, or doesn&apos;t need one. 🎉</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(300px, 5fr) minmax(360px, 7fr)', gap: '0.75rem', alignItems: 'start' }}>
          {showList ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: isMobile ? undefined : '68vh', overflowY: 'auto' }} data-testid="sweep-list">
              <div role="tablist" aria-label="Which jobs to show" style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }} data-testid="sweep-tabs">
                {shownFilters.map((f) => {
                  const on = filter === f
                  return (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      title={filterTitle(f)}
                      onClick={() => {
                        setFilter(f)
                        setSelectedId(null)
                      }}
                      style={tabStyle(on)}
                    >
                      {filterLabel(f)}
                      <span style={tabCountStyle(on)}>{filterCounts[f]}</span>
                    </button>
                  )
                })}
              </div>
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
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', ...(driveFinds.has(j.id) || (st?.flags.length ?? 0) > 1 ? { gridColumn: '1 / -1', justifyContent: 'flex-start', marginTop: 2 } : { justifyContent: 'flex-end' }) }}>
                        {driveFinds.has(j.id) ? <DriveFindChip find={driveFinds.get(j.id)!} /> : null}
                        {st ? <SweepRowChips state={st} /> : null}
                      </div>
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
              {/* Which job this pane is about — it used to be "look left at the highlighted row". */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }} data-testid="sweep-pane-job">
                <b style={{ fontSize: '0.98rem' }}>
                  J{selInput?.jobNumber ?? '—'} · {(selected.job_name ?? '').trim() || 'Job'}
                </b>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[(selected.customer_name ?? '').trim(), (selected.job_address ?? '').trim()].filter(Boolean).join(' · ')}
                </span>
              </div>
              {/* The first question first: does this one need a signature at all? */}
              {(
                <div role="group" aria-label="Does this job need a signature" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden' }} data-testid="sweep-doors">
                  {(
                    [
                      { door: 'send', title: 'We need a signature', sub: alreadyOut ? 'ours is already out — waiting on it' : 'send them our agreement' },
                      { door: 'have', title: 'We already have one', sub: alreadyOut ? 'it came back signed — file it' : selFind ? 'found in Drive — check it and file' : selState?.flags.includes('gc_job') ? 'file the builder’s subcontract' : 'link the contract in Google Drive' },
                    ] as const
                  ).map((d, i) => {
                    const on = d.door === 'have' ? paneFiling : !paneFiling
                    return (
                      <button
                        key={d.door}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => setFiling(d.door === 'have' ? { jobId: selected.id, file: null } : null)}
                        style={{ font: 'inherit', textAlign: 'left', border: 'none', borderLeft: i === 1 ? '1px solid var(--border-strong)' : 'none', padding: '0.55rem 0.7rem', cursor: 'pointer', background: on ? 'var(--surface)' : 'var(--bg-subtle)', color: on ? 'var(--text-strong)' : 'var(--text-muted)', boxShadow: on ? 'inset 0 -3px 0 #2563eb' : 'none' }}
                      >
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem' }}>{d.title}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem' }}>{d.sub}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: paneFiling ? 'none' : 'grid', gridTemplateColumns: `${PANE_LABEL_COL}px minmax(0, 1fr)`, gap: '0.4rem 0.6rem', alignItems: 'center' }}>
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
                <span style={{ ...kLabel, whiteSpace: 'normal', lineHeight: 1.15 }} title="The legal paragraphs every agreement prints — one Contract Book document">Terms</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }} data-testid="sweep-standard-terms">
                  {draftRow ? (
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {draftRow.template_name ?? 'Contract'} · {draftRow.status === 'sent' ? 'sent' : 'draft saved'} {formatContractStamp(draftRow.last_sent_at ?? draftRow.updated_at ?? draftRow.created_at) ?? ''}
                    </span>
                  ) : templates.length > 1 ? (
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...input, width: 'auto', minWidth: 220 }} aria-label="Standard terms for every job in this sweep">
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {standardTermsLabel(t)}
                        </option>
                      ))}
                      <option value={BUILTIN}>Built-in service agreement terms</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{standardTermsLabel(template)}</span>
                  )}
                  {template ? (
                    <button type="button" style={btnGhost} onClick={() => setTermsEditOpen(true)} title="Change the legal wording — it goes on every agreement sent from now on" data-testid="sweep-edit-standard-terms">
                      Edit
                    </button>
                  ) : null}
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>
                    {template ? `the same wording on every agreement — an edit reaches all ${gapRows.length} here` : 'the built-in wording — it becomes editable once the Contract Book holds the Service agreement'}
                  </span>
                </div>
              </div>
              {filing && filing.jobId === selected.id ? (
                <JobContractFileSheet
                  key={`${selected.id}:${filing.file?.name ?? ''}:${selFindPrefills ? (selFind?.link ?? '') : ''}`}
                  layout="inline"
                  inlineTitle={selState?.flags.includes('gc_job') && gcName ? `File ${gcName}'s subcontract` : 'File a signed contract'}
                  jobId={selected.id}
                  defaultSignerName={(selected.customer_name ?? '').trim()}
                  existingDraft={draftRow && (draftRow.status === 'draft' || isAwaitingPaperCopy(draftRow)) ? draftRow : null}
                  basePayload={buildJobContractDraftPayload({
                    jobId: selected.id,
                    fields: paneEdit && paneEdit.jobId === selected.id ? editedFields(selected, paneEdit) : buildJobContractPrefill({ job: selected }),
                    template,
                    recipientName: (selected.customer_name ?? '').trim(),
                    recipientEmail: selEmail,
                    recipientPhone: selected.customer_phone ?? null,
                  })}
                  initialFile={filing.file}
                  initialLink={filing.file || !selFindPrefills ? '' : (selFind?.link ?? '')}
                  // A contract already on file was signed some time ago: start from the file's own date, or none — never today's.
                  initialSignedOn={filing.file ? undefined : selFindPrefills ? (selFind?.signedOn ?? '') : ''}
                  foundNote={
                    selFind && !filing.file ? (
                      <div style={{ border: `1px solid ${selFind.confidence === 'confident' ? 'var(--border-green)' : 'var(--border-amber)'}`, background: selFind.confidence === 'confident' ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.78rem' }} data-testid="sweep-drive-found">
                        <b style={{ color: selFind.confidence === 'confident' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>📄 Found in Drive · {selFind.confidence === 'confident' ? 'confident' : 'check it first'}</b>
                        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                          {selFind.fileName}{' '}
                          <a href={selFind.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            Open ↗
                          </a>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          in <i>{selFind.folderName}</i> · {selFind.reason}
                        </div>
                        {!selFindPrefills ? (
                          <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-amber-800)' }}>Not sure this is their signed contract — open it first.</span>
                            <button type="button" style={btn} onClick={() => setAcceptedFinds((prev) => new Set([...prev, selected.id]))} data-testid="sweep-drive-use">
                              It is — use this file
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : undefined
                  }
                  recordLabel={nextRow ? 'File it & next' : 'File it'}
                  cancelLabel={null}
                  onFiled={() => onFiled(selected)}
                  onCancel={() => setFiling(null)}
                />
              ) : null}
              {paneEdit && paneEdit.jobId === selected.id && !(filing && filing.jobId === selected.id) ? (
                <div style={{ display: 'grid', gridTemplateColumns: `${PANE_LABEL_COL}px minmax(0, 1fr)`, gap: '0.4rem 0.6rem', alignItems: 'start' }} data-testid="sweep-pane-edit">
                  <span style={{ ...kLabel, gridColumn: '1 / -1', color: 'var(--text-700)' }} title="Only this agreement — scope, amount and the payment line">This job</span>
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
                  {/* v2.3707: the job's number, its source and one door — never a box. A draft that says otherwise is named, with one press to put it right. */}
                  <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }} data-testid="sweep-amount">
                    <div style={{ display: 'flex', gap: '0.2rem 0.6rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      <b style={{ fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums', ...(selSrc.cents == null ? { color: 'var(--text-muted)', fontWeight: 600 } : {}) }} data-testid="sweep-amount-value">
                        {selSrc.cents != null ? formatUsdNoCents(selSrc.cents / 100) : 'No amount'}
                      </b>
                      <span style={{ color: 'var(--text-muted)' }}>{contractAmountSourceLabel(selSrc, fmtAcceptedOn)}</span>
                      <button type="button" style={{ ...btnGhost, padding: 0, fontWeight: 600 }} onClick={() => onEditJob(selected)} title="The number is set on the job — its line items, or the estimate the customer accepted" data-testid="sweep-amount-door">
                        {contractAmountDoorLabel(selSrc)}
                      </button>
                      <span style={{ fontSize: '0.7rem', color: saveState === 'error' ? 'var(--text-red-700)' : 'var(--text-faint)' }} data-testid="sweep-save-state">
                        {draftRow && draftRow.status === 'sent' ? 'Locked — sent; Void & redo in the full editor' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved to the job’s draft' : saveState === 'error' ? 'Save failed' : 'Edits save to the job’s draft as you type'}
                      </span>
                    </div>
                    {amountDiffers && draftRow && draftRow.status === 'draft' ? (
                      <div style={{ display: 'flex', gap: '0.3rem 0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.35rem 0.55rem', borderRadius: 6, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', fontSize: '0.76rem' }} data-testid="sweep-amount-differs">
                        <span>
                          This draft still says <b>{amountDiffers.draft}</b>, typed before the number came from the job.
                        </span>
                        <button
                          type="button"
                          style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.74rem', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }}
                          onClick={() => {
                            setUseJobAmount((prev) => new Set([...prev, selected.id]))
                            setPaneEdit((prev) => (prev && prev.jobId === selected.id ? { ...prev, dirty: true } : prev))
                          }}
                          data-testid="sweep-amount-use-job"
                        >
                          Use the job's {amountDiffers.job}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <span style={{ ...kLabel, paddingTop: 6 }}>Payment</span>
                  <div style={{ display: 'grid', gap: '0.35rem' }} data-testid="sweep-payment-terms">
                    <div role="group" aria-label="Payment terms for this job" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {PAYMENT_TERMS_PRESETS.map((preset) => {
                        const on = paneEdit.paymentKey === preset.key
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            aria-pressed={on}
                            disabled={Boolean(draftRow && draftRow.status === 'sent')}
                            onClick={() => setPaneEdit((prev) => (prev ? { ...prev, paymentKey: preset.key, dirty: true } : prev))}
                            style={{ ...btn, padding: '0.22rem 0.6rem', fontSize: '0.74rem', fontWeight: on ? 700 : 500, ...(on ? { background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' } : {}) }}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                    {paneEdit.paymentKey === 'custom' ? (
                      <input
                        style={input}
                        value={paneEdit.paymentText}
                        disabled={Boolean(draftRow && draftRow.status === 'sent')}
                        onChange={(e) => setPaneEdit((prev) => (prev ? { ...prev, paymentText: e.target.value, dirty: true } : prev))}
                        placeholder="The payment sentence this agreement prints — e.g. Net 30 from the invoice date."
                        aria-label="Custom payment terms"
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {!(filing && filing.jobId === selected.id) && !alreadyOut ? (
                <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem 0.55rem', margin: 0, display: 'grid', gap: '0.35rem', minWidth: 0 }} data-testid="sweep-signing-ways">
                  <legend style={{ ...kLabel, padding: '0 0.3rem' }}>How this one gets signed</legend>
                  {/* v2.3706: the three ways as one row; the line under says what the chosen one does, and which are out and why. */}
                  {waysRow(waysPlan.ways, 'How this one gets signed')}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }} data-testid="sweep-way-detail">
                    {wayLine.detail}
                    {wayLine.note ? <span style={{ color: 'var(--text-amber-800)' }}> {wayLine.note}.</span> : null}
                  </div>
                  {waysPlan.demoted.length > 0 ? (
                    oursOpenFor === selected.id || waysPlan.demoted.some((o) => o.way === way) ? (
                      <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.15rem' }}>
                        <span style={{ ...kLabel, letterSpacing: 0, textTransform: 'none', fontSize: '0.7rem', fontWeight: 600 }}>Send ours anyway</span>
                        {waysRow(waysPlan.demoted, 'Send ours anyway')}
                      </div>
                    ) : (
                      <button type="button" style={{ ...btnGhost, justifySelf: 'start', color: 'var(--text-muted)', padding: 0 }} onClick={() => setOursOpenFor(selected.id)} data-testid="sweep-send-ours">
                        Send ours anyway ▸
                      </button>
                    )
                  ) : null}
                </fieldset>
              ) : null}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', opacity: filing && filing.jobId === selected.id ? 0.45 : 1 }}>
                <iframe title="The agreement as the customer will see it" srcDoc={paneHtml} sandbox="" style={{ width: '100%', height: isMobile ? '60vh' : '54vh', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', display: 'block' }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '0.3rem' }}>Exactly what the signing page and the PDF will show{draftRow ? '' : ' — from the job’s fixtures or its accepted estimate, and the terms above'}.</div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <DriveContractsFoundModal
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        jobs={gapRows}
        onFiled={(ids) => {
          setFiledIds((prev) => new Set([...prev, ...ids]))
          dispatchJobContractChanged()
          onSent()
        }}
      />
      {termsEditOpen && template ? (
        <StandardTermsEditModal
          doc={template}
          openJobs={gapRows.length}
          onClose={() => setTermsEditOpen(false)}
          onSaved={(saved) => {
            setTemplates((prev) => prev.map((t) => (t.id === saved.id ? { ...t, document_name: saved.document_name, book_body_html: saved.book_body_html, book_version_date: saved.book_version_date } : t)))
            setTermsEditOpen(false)
            // The selected job's unsent draft carries the old wording until it is saved again — save it now.
            setPaneEdit((prev) => (prev && draftRow && draftRow.status === 'draft' ? { ...prev, dirty: true } : prev))
          }}
        />
      ) : null}
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
        onEditJob={onEditJob}
      />
    </ResponsiveModalShell>
  )
}
