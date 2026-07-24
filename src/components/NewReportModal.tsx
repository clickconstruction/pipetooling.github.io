import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import { isTurnawayTemplateName } from '../lib/turnaway'
import { fieldValueForSubmit, normalizePercentFieldValueToString } from '../lib/reportTemplateFieldDisplay'
import { reportSaysJobComplete } from '../lib/reportReadyToBillPrompt'
import { REPORT_SIGNATURE_ON_FILE, validateReportSignatureDataUrlForSubmit } from '../lib/reportSignatureField'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportTemplateSignatureField } from './ReportTemplateSignatureField'
import { MarkJobReadyToBillPrompt } from './jobs/MarkJobReadyToBillPrompt'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../lib/stickyModalHeaderStyle'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

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

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      // Turnaway is filed only through the Job Mode TurnawayModal (which also
      // creates the dispatch request), so keep it out of the generic picker.
      const list = ((data as ReportTemplate[]) ?? []).filter((t) => !isTurnawayTemplateName(t.name))
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
        setFieldValues({})
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
    if (!open || !lastReportJob || initialJob || jobSearchText !== '') return
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
  }

  function handleClose() {
    reset()
    onClose()
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
        const n = normalizePercentFieldValueToString(fieldValues[f.label])
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
      fv[f.label] = fieldValueForSubmit(f, fieldValues)
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
    // If this is a job report marked 100% complete and the job is still Working, offer to move it
    // to Ready to bill before closing.
    if (jobLedgerId && reportSaysJobComplete(fv)) {
      const { data: jobRow } = await supabase
        .from('jobs_ledger')
        .select('status')
        .eq('id', jobLedgerId)
        .maybeSingle()
      if ((jobRow as { status?: string | null } | null)?.status === 'working') {
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
      {/* This panel is the scroller — the title bar sticks so the × stays reachable
          on a phone instead of scrolling away once the form fills in (v2.990 pattern). */}
      <div style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: '90vh', overflow: 'auto', ...stickyModalPanelStyle(560) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
          <h2 style={{ margin: 0 }}>New report</h2>
          <button type="button" onClick={handleClose} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>Job, project, or bid *</p>
              {lastReportJob && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchMode === 'last') {
                      setSelectedJob(null)
                      setSearchMode('search')
                    } else {
                      setSearchMode('last')
                      setSelectedJob(lastReportJob)
                      setSearchResults([])
                      setJobSearchText('')
                    }
                  }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: searchMode === 'last' ? '2px solid #3b82f6' : '1px solid var(--border-strong)', background: searchMode === 'last' ? 'var(--bg-blue-tint)' : 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Same as last report:{' '}
                  {lastReportJob.display_name}
                  {lastReportJob.hcp_number
                    ? lastReportJob.source === 'bid'
                      ? ` (Bid #${lastReportJob.hcp_number})`
                      : ` (HCP: ${lastReportJob.hcp_number})`
                    : ''}
                </button>
              )}
            </div>
            {selectedJob && (
              <div style={{ margin: 0, padding: '0.5rem', background: 'var(--bg-muted)', borderRadius: 4 }}>
                <div>
                  Selected: {selectedJob.display_name} (
                  {selectedJob.source === 'bid'
                    ? `Bid #${selectedJob.hcp_number || '—'}`
                    : `HCP: ${selectedJob.hcp_number || '—'}`}
                  )
                </div>
                {selectedJob.address && <div style={{ marginTop: '0.25rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>{selectedJob.address}</div>}
              </div>
            )}
            <input
              type="text"
              value={jobSearchText}
              onChange={(e) => { setJobSearchText(e.target.value); setSearchMode('search'); setSelectedJob(null) }}
              placeholder="Search job HCP, project, bid #, or address"
              style={{
                width: '100%',
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
                    style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedJob?.id === r.id && selectedJob?.source === r.source ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
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
                  {displayReportTemplateName(t.name, userRole)}
                </button>
              ))}
            </div>
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
                      value={fieldValues[f.label] ?? '0'}
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
                    <textarea
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Save report'}</button>
              {!canSubmit && !saving && missingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
