import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'
import { additionalReportModalTemplateChipLabel, isJobCompleteTemplateName } from '../lib/reportTemplateDisplayName'
import { isTurnawayTemplateName } from '../lib/turnaway'
import { fieldValueForSubmit, normalizePercentFieldValueToString } from '../lib/reportTemplateFieldDisplay'
import { reportSaysJobComplete } from '../lib/reportReadyToBillPrompt'
import { propagateReportPctToJob } from '../lib/propagateReportPctToJob'
import { recordedPercentProvenance, reportPercentSeedHint, seedUntouchedPercentFields, type JobPercentProvenance } from '../lib/jobPercentProvenance'
import { REPORT_SIGNATURE_ON_FILE, validateReportSignatureDataUrlForSubmit } from '../lib/reportSignatureField'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportTemplateSignatureField } from './ReportTemplateSignatureField'
import { MarkJobReadyToBillPrompt } from './jobs/MarkJobReadyToBillPrompt'
import ResponsiveModalShell from './ResponsiveModalShell'
import AutoGrowTextarea from './AutoGrowTextarea'
import ConfirmDialog from './ConfirmDialog'
import { hasUnsavedReportEntries } from '../lib/reportFormDirty'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import TurnawayModal from './jobMode/TurnawayModal'
import { denverCalendarDayKey } from '../utils/dateUtils'
import { TURNAWAY_REPORT_OPTION_LABEL, TURNAWAY_REPORT_OPTION_SUB, shouldOfferTurnawayInReportPicker } from '../lib/turnawayReportOption'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']
type Report = Database['public']['Tables']['reports']['Row']

type JobSearchResult = {
  id: string
  source: 'job_ledger' | 'project' | 'bid'
  display_name: string
  hcp_number: string
  address?: string
}

function jobNumberLabel(j: Pick<JobSearchResult, 'source' | 'hcp_number'>): string {
  return j.source === 'bid' ? `Bid #${j.hcp_number || '—'}` : `HCP ${j.hcp_number || '—'}`
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  authUserId: string | null
  userRole?: UserRole | null
  initialJob?: { id: string; source: 'job_ledger' | 'project' | 'bid'; display_name: string; hcp_number: string; address?: string }
  initialTemplateName?: string
}

export default function NewReportModal({ open, onClose, onSaved, authUserId, userRole, initialJob, initialTemplateName }: Props) {
  const { showToast } = useToastContext()
  const { profileName } = useAuth()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateFields, setTemplateFields] = useState<Record<string, ReportTemplateField[]>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [jobSearchText, setJobSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<JobSearchResult[]>([])
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null)
  const [lastReportJob, setLastReportJob] = useState<JobSearchResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'search' | 'last'>('search')
  const [copyJustClicked, setCopyJustClicked] = useState(false)
  const [readyToBillJob, setReadyToBillJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  /** Turnaway door (v2.2210): true when the picked ledger job has a schedule block for me today. */
  const [scheduledToday, setScheduledToday] = useState(false)
  const [turnawayOpen, setTurnawayOpen] = useState(false)
  /** The picked job's recorded % and who set it (v2.2852) — seeds the percent slider ("Currently 30%"). */
  const [jobPctSeed, setJobPctSeed] = useState<{ jobId: string; pct: number | null; provenance: JobPercentProvenance } | null>(null)
  /** Once the tech taps Change, emptying the search box must not re-auto-select the last job. */
  const suppressAutoSelectRef = useRef(false)

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      // Turnaway is filed only through the Job Mode TurnawayModal (which also
      // creates the dispatch request); Job Complete is retired (Status at 100%
      // covers it). Keep both out of the generic picker.
      const list = ((data as ReportTemplate[]) ?? []).filter(
        (t) => !isTurnawayTemplateName(t.name) && !isJobCompleteTemplateName(t.name),
      )
      setTemplates(list)
      if (list.length > 0) {
        if (initialTemplateName) {
          const match = list.find((t) => t.name.toLowerCase() === initialTemplateName!.toLowerCase())
          setSelectedTemplateId(match?.id ?? list[0]!.id)
        } else if (!selectedTemplateId) {
          setSelectedTemplateId(list[0]!.id)
        }
      }
    })
  }, [open, initialTemplateName])

  useEffect(() => {
    // Turnaway door (v2.2210): show it only when the picked job is on MY schedule
    // today (same source Job Mode reads). Cheap head-count per job selection.
    let cancelled = false
    setScheduledToday(false)
    if (!open || !authUserId || !selectedJob || selectedJob.source !== 'job_ledger') return
    void (async () => {
      const { count } = await supabase
        .from('job_schedule_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_user_id', authUserId)
        .eq('job_id', selectedJob.id)
        .eq('work_date', denverCalendarDayKey(Date.now()))
      if (!cancelled) setScheduledToday((count ?? 0) > 0)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, authUserId, selectedJob?.id, selectedJob?.source])

  useEffect(() => {
    // Slider seed (v2.2852, J2-F1): the job's recorded % and who set it, so the form opens on
    // "Currently 30% — move to update" instead of 0. Best-effort — a failed read keeps the old 0 start.
    let cancelled = false
    if (!open || !selectedJob || selectedJob.source !== 'job_ledger') {
      setJobPctSeed(null)
      return
    }
    const jobId = selectedJob.id
    void (async () => {
      try {
        const [{ data: jobRow }, { data: reportRows }] = await Promise.all([
          supabase.from('jobs_ledger').select('pct_complete').eq('id', jobId).maybeSingle(),
          supabase.from('reports').select('created_at, field_values').eq('job_ledger_id', jobId).order('created_at', { ascending: false }).limit(25),
        ])
        if (cancelled) return
        const pct = (jobRow as { pct_complete?: number | null } | null)?.pct_complete ?? null
        const reports = ((reportRows ?? []) as Array<{ created_at: string; field_values: unknown }>).map((r) => ({
          created_at: r.created_at,
          field_values:
            r.field_values && typeof r.field_values === 'object' && !Array.isArray(r.field_values)
              ? (r.field_values as Record<string, unknown>)
              : null,
        }))
        setJobPctSeed({ jobId, pct, provenance: recordedPercentProvenance(pct, reports) })
      } catch {
        if (!cancelled) setJobPctSeed(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedJob])

  const seedForSelected =
    selectedJob && selectedJob.source === 'job_ledger' && jobPctSeed && jobPctSeed.jobId === selectedJob.id ? jobPctSeed : null
  /** Percent fields the tech has not touched read as the job's current % — display, copy and save all agree. */
  const seededFieldValues = (fields: ReportTemplateField[]) => seedUntouchedPercentFields(fields, fieldValues, seedForSelected?.pct ?? null)

  useEffect(() => {
    if (open && initialJob) {
      setSelectedJob(initialJob)
      setSearchMode('search')
    }
  }, [open, initialJob])

  useEffect(() => {
    if (!selectedTemplateId) return
    supabase
      .from('report_template_fields')
      .select('*')
      .eq('template_id', selectedTemplateId)
      .order('sequence_order')
      .then(({ data }) => {
        const fields = (data as ReportTemplateField[]) ?? []
        setTemplateFields((prev) => ({ ...prev, [selectedTemplateId]: fields }))
        // Deliberately NOT clearing fieldValues (v2.1025): values key on field
        // label and submit/copy read only the current template's fields, so
        // switching report types keeps everything typed — jump Status → Note
        // and back without losing the status text. reset() still clears on close.
      })
  }, [selectedTemplateId])

  useEffect(() => {
    if (!open || !authUserId) return
    supabase
      .from('reports')
      .select('id, job_ledger_id, project_id, bid_id, created_at')
      .eq('created_by_user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = data as (Report & { job_ledger_id?: string | null; project_id?: string | null; bid_id?: string | null }) | null
        if (!r) {
          setLastReportJob(null)
          return
        }
        const source: JobSearchResult['source'] = r.bid_id
          ? 'bid'
          : r.job_ledger_id
            ? 'job_ledger'
            : 'project'
        const id = r.bid_id ?? r.job_ledger_id ?? r.project_id
        if (!id) return
        const { data: row } = await supabase.rpc('get_job_display_for_report', { p_source: source, p_id: id })
        const first = (row as JobSearchResult[] | null)?.[0]
        if (first) setLastReportJob({ ...first, source })
      })
  }, [open, authUserId])

  useEffect(() => {
    if (!open || !lastReportJob || initialJob || jobSearchText !== '' || suppressAutoSelectRef.current) return
    setSelectedJob(lastReportJob)
    setSearchMode('last')
  }, [open, lastReportJob, initialJob, jobSearchText])

  useEffect(() => {
    if (!open || searchMode !== 'search') return
    const q = jobSearchText.trim()
    supabase.rpc('search_jobs_for_reports', { search_text: q }).then(async ({ data }) => {
      let raw = (data as JobSearchResult[] | null) ?? []
      if (raw.length > 0) {
        const jobIds = raw.filter((r) => r.source === 'job_ledger').map((r) => r.id)
        const jobAddrMap: Record<string, string> = {}
        if (jobIds.length > 0) {
          const { data: jobRows } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
          for (const r of (jobRows ?? []) as { id: string; job_address?: string }[]) {
            jobAddrMap[r.id] = r.job_address ?? ''
          }
        }
        raw = raw.map((r) => ({
          ...r,
          address: (r.address && r.address.trim()) || (r.source === 'job_ledger' ? jobAddrMap[r.id] : r.address ?? '') || '',
        }))
      }
      setSearchResults(raw)
    })
  }, [open, jobSearchText, searchMode])

  function reset() {
    setSelectedJob(null)
    setJobSearchText('')
    setSearchResults([])
    setFieldValues({})
    setError(null)
    setDiscardConfirmOpen(false)
    suppressAutoSelectRef.current = false
  }

  function handleClose() {
    reset()
    onClose()
  }

  /** Every close path (×, Cancel, Escape, backdrop) — confirms first when the
   * tech has typed anything, so an accidental tap can't lose a report. The
   * discardConfirmOpen guard also keeps the shell's Escape handler from
   * re-opening the prompt while it is already up. */
  function guardedClose() {
    if (saving || discardConfirmOpen) return
    if (hasUnsavedReportEntries(fieldValues)) {
      setDiscardConfirmOpen(true)
      return
    }
    handleClose()
  }

  async function handleCopyToText() {
    const fields = templateFields[selectedTemplateId] ?? []
    const parts: string[] = []
    if (selectedJob) {
      if (selectedJob.source === 'bid') {
        parts.push(
          `Bid: ${selectedJob.display_name}${selectedJob.hcp_number ? ` (Bid #${selectedJob.hcp_number})` : ''}`,
        )
      } else {
        parts.push(`Job: ${selectedJob.display_name}${selectedJob.hcp_number ? ` (HCP: ${selectedJob.hcp_number})` : ''}`)
      }
    }
    for (const f of fields) {
      const t = f.input_type ?? 'long_text'
      if (t === 'percent_0_100') {
        const n = normalizePercentFieldValueToString(seededFieldValues(fields)[f.label])
        parts.push(`${f.label}:\n${n}%`)
      } else if (t === 'signature_png') {
        const raw = (fieldValues[f.label] ?? '').trim()
        parts.push(`${f.label}:\n${raw ? REPORT_SIGNATURE_ON_FILE : ''}`)
      } else {
        const val = (fieldValues[f.label] ?? '').trim()
        if (val) parts.push(`${f.label}:\n${val}`)
      }
    }
    let text = parts.join('\n\n')
    if (!text) return
    // iOS Safari treats text with "Word:" patterns as a URL and URL-encodes it when pasting.
    // Insert U+2066 (LEFT-TO-RIGHT ISOLATE) before label colons to prevent this.
    text = text.replace(/(^|\n)([^\s:]+):/g, '$1$2\u2066:')
    try {
      await navigator.clipboard.writeText(text)
      setCopyJustClicked(true)
      setTimeout(() => setCopyJustClicked(false), 1500)
      showToast('Copied to clipboard', 'success')
    } catch (err) {
      console.error('Failed to copy:', err)
      showToast('Failed to copy to clipboard', 'error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !selectedJob || !selectedTemplateId) return
    setSaving(true)
    setError(null)
    const fields = templateFields[selectedTemplateId] ?? []
    for (const f of fields) {
      if ((f.input_type ?? 'long_text') === 'signature_png') {
        const msg = validateReportSignatureDataUrlForSubmit(fieldValues[f.label] ?? '')
        if (msg) {
          setError(msg)
          setSaving(false)
          return
        }
      }
    }
    const fv: Record<string, string> = {}
    for (const f of fields) {
      fv[f.label] = fieldValueForSubmit(f, seededFieldValues(fields))
    }
    const jobLedgerId = selectedJob.source === 'job_ledger' ? selectedJob.id : null
    const projectId = selectedJob.source === 'project' ? selectedJob.id : null
    const bidId = selectedJob.source === 'bid' ? selectedJob.id : null

    let reportedAtLat: number | null = null
    let reportedAtLng: number | null = null
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          })
        })
        reportedAtLat = pos.coords.latitude
        reportedAtLng = pos.coords.longitude
      } catch {
        // Proceed without location
      }
    }

    let inserted: { id: string } | null = null
    let err: { message: string } | null = null

    if (userRole === 'estimator') {
      // Use RPC - SECURITY DEFINER bypasses RLS (fixes estimator insert policy issues)
      // RPC accepts null for two of job_ledger_id / project_id / bid_id; generated types are stricter
      const { data: reportId, error: rpcErr } = await supabase.rpc('insert_report', {
        p_template_id: selectedTemplateId,
        p_field_values: fv,
        p_job_ledger_id: jobLedgerId,
        p_project_id: projectId,
        p_bid_id: bidId,
        p_reported_at_lat: reportedAtLat ?? undefined,
        p_reported_at_lng: reportedAtLng ?? undefined,
      } as never)
      err = rpcErr
      if (reportId && typeof reportId === 'string') inserted = { id: reportId }
    } else {
      const { data: sessionUser } = await supabase.auth.getUser()
      const createdByUserId = sessionUser?.user?.id ?? authUserId
      const { data: row, error: insertErr } = await supabase.from('reports').insert({
        template_id: selectedTemplateId,
        created_by_user_id: createdByUserId,
        field_values: fv,
        ...(bidId
          ? { job_ledger_id: null, project_id: null, bid_id: bidId }
          : jobLedgerId
            ? { job_ledger_id: jobLedgerId, project_id: null, bid_id: null }
            : { job_ledger_id: null, project_id: projectId!, bid_id: null }),
        ...(reportedAtLat != null &&
          reportedAtLng != null && { reported_at_lat: reportedAtLat, reported_at_lng: reportedAtLng }),
      }).select('id').single()
      err = insertErr
      inserted = row ?? null
    }
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    // Best-effort report notification + subscriber emails (fire-and-forget; report is already saved).
    if (inserted?.id) {
      void supabase.functions
        .invoke('send-report-notification', { body: { report_id: inserted.id } })
        .catch(() => { /* notification is best-effort */ })
      void supabase.functions
        .invoke('send-report-email', { body: { report_id: inserted.id } })
        .catch(() => { /* report email is best-effort */ })
    }
    // Job reports: mirror the completion percent into jobs_ledger.pct_complete
    // (best-effort — the Stages % done, progress dot, and My Schedule deltas
    // follow from it), then offer Ready to bill when a 100% report lands on a
    // Working job.
    if (jobLedgerId) {
      const { jobStatus, pctError } = await propagateReportPctToJob(jobLedgerId, fv)
      if (pctError) {
        showToast(`Report saved, but the job's % done could not update: ${pctError}`, 'warning')
      }
      if (reportSaysJobComplete(fv) && jobStatus === 'working') {
        setReadyToBillJob({
          id: jobLedgerId,
          hcpNumber: selectedJob.hcp_number || '—',
          jobName: selectedJob.display_name || '—',
        })
        return
      }
    }
    onSaved()
    handleClose()
  }

  function finishReadyToBillPrompt() {
    setReadyToBillJob(null)
    onSaved()
    handleClose()
  }

  // Freeze the page behind the modal — dragging inside it used to scroll the
  // list underneath on a phone, and closing then landed somewhere else.
  useBodyScrollLock(open)

  if (!open) return null

  if (readyToBillJob) {
    return <MarkJobReadyToBillPrompt job={readyToBillJob} onClose={finishReadyToBillPrompt} />
  }

  const fields = templateFields[selectedTemplateId] ?? []
  const canSubmit = selectedJob && selectedTemplateId && authUserId

  const missingFields: string[] = []
  if (!selectedJob) missingFields.push('Job, project, or bid')
  if (!selectedTemplateId) missingFields.push('Report type')

  const footer = (
    <>
      {!canSubmit && !saving && missingFields.length > 0 && (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#FF6600' }}>
          Required: {missingFields.join(' · ')}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleCopyToText}
          disabled={fields.length === 0 || !fields.some((f) => (fieldValues[f.label] ?? '').trim())}
          style={{
            padding: '0.5rem 1rem',
            border: copyJustClicked ? '1px solid #22c55e' : '1px solid var(--border-strong)',
            background: copyJustClicked ? 'var(--bg-green-100)' : 'var(--surface)',
            borderRadius: 4,
            cursor: 'pointer',
            color: copyJustClicked ? '#16a34a' : undefined,
            fontWeight: copyJustClicked ? 600 : undefined,
          }}
        >
          {copyJustClicked ? 'Copied!' : 'Copy to Text'}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" onClick={guardedClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" form="new-report-form" disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Save report'}</button>
        </div>
      </div>
    </>
  )

  return (
    <>
    <ResponsiveModalShell title="New report" onRequestClose={guardedClose} footer={footer}>
        <form id="new-report-form" onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>Reporting on *</p>
            {selectedJob ? (
              /* Selected state: one card, one Change affordance — the search UI only
                 exists while choosing (the old pill/box/input stack read the same job
                 twice and hid how to switch). */
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border)', background: 'var(--bg-muted)', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
                <span aria-hidden="true" style={{ color: '#16a34a', fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>
                    {selectedJob.display_name}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {jobNumberLabel(selectedJob)}</span>
                  </div>
                  {selectedJob.address && <div style={{ color: 'var(--text-600)', fontSize: '0.8125rem' }}>{selectedJob.address}</div>}
                  {searchMode === 'last' && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Same as your last report</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    suppressAutoSelectRef.current = true
                    setSelectedJob(null)
                    setSearchMode('search')
                    setJobSearchText('')
                    setSearchResults([])
                  }}
                  style={{ flexShrink: 0, padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
            <input
              type="text"
              value={jobSearchText}
              onChange={(e) => { setJobSearchText(e.target.value); setSearchMode('search') }}
              placeholder="Search job HCP, project, bid #, or address"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.5rem',
                border: '1px solid var(--border-strong)',
                // Attach the results panel below like a combobox when it is open.
                ...(searchMode === 'search' && searchResults.length > 0
                  ? { marginBottom: 0, borderRadius: '4px 4px 0 0' }
                  : { marginBottom: '0.5rem', borderRadius: 4 }),
              }}
            />
            {searchMode === 'search' && searchResults.length > 0 && (
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-strong)', borderTop: 'none', borderRadius: '0 0 4px 4px', marginBottom: '0.5rem' }}>
                {jobSearchText.trim() === '' ? (
                  <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    Suggested · recent jobs & bids — type to search
                  </div>
                ) : null}
                {searchResults.map((r) => (
                  <button
                    key={`${r.source}-${r.id}`}
                    type="button"
                    onClick={() => { setSelectedJob(r); setSearchResults([]) }}
                    style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: 'var(--surface)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    {r.source === 'bid' ? (
                      <span style={{ marginRight: 6, fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed' }}>BID</span>
                    ) : null}
                    {r.display_name}{' '}
                    {r.hcp_number
                      ? r.source === 'bid'
                        ? `(Bid #${r.hcp_number})`
                        : `(HCP: ${r.hcp_number})`
                      : ''}
                    {r.address ? `  -  ${r.address}` : ''}
                  </button>
                ))}
              </div>
            )}
            {lastReportJob && jobSearchText.trim() === '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suggested:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJob(lastReportJob)
                    setSearchMode('last')
                    setSearchResults([])
                    setJobSearchText('')
                  }}
                  style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 999, cursor: 'pointer' }}
                >
                  ↩ {lastReportJob.display_name} · {jobNumberLabel(lastReportJob)}
                </button>
              </div>
            )}
              </>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Report type</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    border: selectedTemplateId === t.id ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                    background: selectedTemplateId === t.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: selectedTemplateId === t.id ? 600 : 400,
                  }}
                >
                  {/* Short chip labels ("Status", "Walk") — same helper as Additional Report. */}
                  {additionalReportModalTemplateChipLabel(t.name, userRole ?? null)}
                </button>
              ))}
            </div>
            {shouldOfferTurnawayInReportPicker(selectedJob?.source ?? null, scheduledToday) ? (
              <button
                type="button"
                onClick={() => setTurnawayOpen(true)}
                title="Opens the Turnaway form — files the field report and alerts Dispatch, same as Job Mode"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  textAlign: 'left',
                  marginTop: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  background: 'var(--bg-amber-tint, var(--bg-amber-100))',
                  border: '1px solid var(--border-amber-soft)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span aria-hidden style={{ fontSize: '1rem' }}>{'\u26A0\uFE0F'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-amber-800)' }}>{TURNAWAY_REPORT_OPTION_LABEL}</span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{TURNAWAY_REPORT_OPTION_SUB}</span>
                </span>
                <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-amber-800)', fontSize: '1rem' }}>{'\u203A'}</span>
              </button>
            ) : null}
          </div>

          {fields.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {fields.map((f) => {
                const t = f.input_type ?? 'long_text'
                if (t === 'percent_0_100') {
                  return (
                    <ReportTemplatePercentField
                      key={f.id}
                      id={`new-report-pct-${f.id}`}
                      label={f.label}
                      value={seededFieldValues(fields)[f.label] ?? '0'}
                      hint={reportPercentSeedHint(seedForSelected?.pct, fieldValues[f.label], seedForSelected?.provenance)}
                      onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.label]: v }))}
                    />
                  )
                }
                if (t === 'signature_png') {
                  return (
                    <ReportTemplateSignatureField
                      key={f.id}
                      reactKeyPrefix={`new-${selectedTemplateId}-${f.id}`}
                      id={`new-report-sig-${f.id}`}
                      label={f.label}
                      value={fieldValues[f.label] ?? ''}
                      onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.label]: v }))}
                      captionBelowCanvas={profileName?.trim() ? profileName : null}
                    />
                  )
                }
                return (
                  <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{f.label}</label>
                    <AutoGrowTextarea
                      value={fieldValues[f.label] ?? ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                      rows={3}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        </form>
    </ResponsiveModalShell>
    {discardConfirmOpen && (
      <ConfirmDialog
        title="Discard this report?"
        body="Your entries will be lost."
        confirmLabel="Discard report"
        cancelLabel="Keep writing"
        onCancel={() => setDiscardConfirmOpen(false)}
        onConfirm={() => {
          setDiscardConfirmOpen(false)
          handleClose()
        }}
      />
    )}
      {turnawayOpen && selectedJob && selectedJob.source === 'job_ledger' ? (
        // Lift above this picker's z-index (1100) — TurnawayModal's own overlay sits at 65 for Job Mode.
        <div style={{ position: 'relative', zIndex: 1200 }}>
          <TurnawayModal
          open={turnawayOpen}
          onClose={() => setTurnawayOpen(false)}
          onSubmitted={() => {
            // Turnaway filed (report + dispatch alert) — the picker's job is done too.
            setTurnawayOpen(false)
            onSaved()
            onClose()
          }}
          authUserId={authUserId}
          userRole={userRole}
          jobId={selectedJob.id}
          hcpNumber={selectedJob.hcp_number}
          jobName={selectedJob.display_name}
          jobAddress={selectedJob.address ?? ''}
        />
        </div>
      ) : null}
    </>
  )
}
