import { useState, useEffect, type CSSProperties } from 'react'
import { Folder, Images } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import {
  additionalReportModalBlueChipTemplate,
  additionalReportModalTemplateChipLabel,
  findStatusReportTemplateId,
} from '../lib/reportTemplateDisplayName'
import { fieldValueForSubmit } from '../lib/reportTemplateFieldDisplay'
import { reportSaysJobComplete } from '../lib/reportReadyToBillPrompt'
import { validateReportSignatureDataUrlForSubmit } from '../lib/reportSignatureField'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { withSupabaseRetry } from '../utils/errorHandling'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportTemplateSignatureField } from './ReportTemplateSignatureField'
import { MarkJobReadyToBillPrompt } from './jobs/MarkJobReadyToBillPrompt'
import JobReportsModal from './JobReportsModal'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']

const TOAST_NO_CUSTOMER_FILES =
  "Customer Files isn't linked for this job yet. Contact Dispatch to have it added."

const TOAST_NO_CUSTOMER_PICTURES =
  "Customer Pictures isn't linked for this job yet. Contact Dispatch to have it added."

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Invoked after a report is saved from the nested Job Reports UI (Dashboard refreshes assigned-job nag state). */
  onReportSaved?: () => void
  authUserId: string | null
  userRole?: UserRole | null
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  /** Backdrop stacking; clock-out review uses 1000+ so nested leave-report must stack above it. */
  overlayZIndex?: number
}

export default function AdditionalReportModal({
  open,
  onClose,
  onSaved,
  onReportSaved,
  authUserId,
  userRole,
  jobId,
  hcpNumber,
  jobName,
  jobAddress,
  overlayZIndex = 65,
}: Props) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateFields, setTemplateFields] = useState<Record<string, ReportTemplateField[]>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showJobReportsModal, setShowJobReportsModal] = useState(false)
  const [jobLinksLoading, setJobLinksLoading] = useState(false)
  const [customerFilesUrl, setCustomerFilesUrl] = useState('')
  const [customerPicturesUrl, setCustomerPicturesUrl] = useState('')
  const [readyToBillJob, setReadyToBillJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)

  useEffect(() => {
    if (!open) {
      setJobLinksLoading(false)
      setCustomerFilesUrl('')
      setCustomerPicturesUrl('')
      return
    }
    let cancelled = false
    setJobLinksLoading(true)
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger')
              .select('google_drive_link, job_pictures_link')
              .eq('id', jobId)
              .maybeSingle(),
          'AdditionalReportModal job customer links',
        )
        if (cancelled) return
        const row =
          data && typeof data === 'object' && data !== null
            ? (data as { google_drive_link?: string | null; job_pictures_link?: string | null })
            : null
        setCustomerFilesUrl((row?.google_drive_link ?? '').trim())
        setCustomerPicturesUrl((row?.job_pictures_link ?? '').trim())
      } catch {
        if (!cancelled) {
          setCustomerFilesUrl('')
          setCustomerPicturesUrl('')
        }
      } finally {
        if (!cancelled) setJobLinksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, jobId])

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      const list = (data as ReportTemplate[]) ?? []
      setTemplates(list)
      if (list.length > 0) {
        const id = findStatusReportTemplateId(list) ?? list[0]?.id
        if (id) setSelectedTemplateId(id)
      }
    })
  }, [open])

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

  function reset() {
    setFieldValues({})
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !selectedTemplateId) return
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
      // RPC accepts null for p_project_id when p_job_ledger_id is set; generated types are stricter
      const { data: reportId, error: rpcErr } = await supabase.rpc('insert_report', {
        p_template_id: selectedTemplateId,
        p_field_values: fv,
        p_job_ledger_id: jobId,
        p_project_id: null as unknown as string,
        p_reported_at_lat: reportedAtLat ?? undefined,
        p_reported_at_lng: reportedAtLng ?? undefined,
      })
      err = rpcErr
      if (reportId && typeof reportId === 'string') inserted = { id: reportId }
    } else {
      const { data: sessionUser } = await supabase.auth.getUser()
      const createdByUserId = sessionUser?.user?.id ?? authUserId
      const { data: row, error: insertErr } = await supabase.from('reports').insert({
        template_id: selectedTemplateId,
        created_by_user_id: createdByUserId,
        field_values: fv,
        job_ledger_id: jobId,
        project_id: null,
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
    // Best-effort report notification (fire-and-forget; report is already saved).
    if (inserted?.id) {
      void supabase.functions
        .invoke('send-report-notification', { body: { report_id: inserted.id } })
        .catch(() => { /* notification is best-effort */ })
    }
    // If the job was marked 100% complete and is still Working, offer to move it to Ready to bill.
    if (reportSaysJobComplete(fv)) {
      const { data: jobRow } = await supabase
        .from('jobs_ledger')
        .select('status')
        .eq('id', jobId)
        .maybeSingle()
      if ((jobRow as { status?: string | null } | null)?.status === 'working') {
        setReadyToBillJob({ id: jobId, hcpNumber: hcpNumber || '—', jobName: jobName || '—' })
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

  if (!open) return null

  if (readyToBillJob) {
    return <MarkJobReadyToBillPrompt job={readyToBillJob} onClose={finishReadyToBillPrompt} />
  }

  const fields = templateFields[selectedTemplateId] ?? []
  const canSubmit = selectedTemplateId && authUserId

  function reportTypeChipStyles(templateId: string, templateName: string): CSSProperties {
    const selected = selectedTemplateId === templateId
    const blueIdle = additionalReportModalBlueChipTemplate(templateName)
    const base: CSSProperties = {
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      borderRadius: 4,
      cursor: 'pointer',
    }
    if (selected) {
      return {
        ...base,
        border: '2px solid #3b82f6',
        background: '#eff6ff',
        fontWeight: 600,
      }
    }
    if (blueIdle) {
      return {
        ...base,
        border: '1px solid #3b82f6',
        background: '#eff6ff',
        color: '#1e40af',
        fontWeight: 500,
      }
    }
    return {
      ...base,
      border: '1px solid #d1d5db',
      background: 'white',
      fontWeight: 400,
    }
  }
  return (
    <>
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
    >
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Additional Report</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', fontWeight: 500 }}>
              {hcpNumber} {jobName}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {jobAddress}
            </p>
          </div>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={jobLinksLoading}
            onClick={() => {
              if (jobLinksLoading) return
              if (customerFilesUrl) openInExternalBrowser(customerFilesUrl)
              else showToast(TOAST_NO_CUSTOMER_FILES, 'warning', undefined, undefined, 'center')
            }}
            aria-label={
              jobLinksLoading
                ? 'Loading Customer Files link'
                : customerFilesUrl
                  ? 'Open Customer Files link'
                  : 'Customer Files not linked; contact Dispatch'
            }
            title={
              jobLinksLoading
                ? 'Loading…'
                : customerFilesUrl
                  ? 'Open Customer Files'
                  : TOAST_NO_CUSTOMER_FILES
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              padding: 0,
              border: `1px solid ${
                jobLinksLoading ? '#e5e7eb' : customerFilesUrl ? '#c7d2fe' : '#fecaca'
              }`,
              borderRadius: 6,
              background: '#fff',
              cursor: jobLinksLoading ? 'not-allowed' : 'pointer',
              opacity: jobLinksLoading ? 0.85 : 1,
              color: jobLinksLoading ? '#9ca3af' : customerFilesUrl ? '#2563eb' : '#dc2626',
            }}
          >
            <Folder size={22} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            disabled={jobLinksLoading}
            onClick={() => {
              if (jobLinksLoading) return
              if (customerPicturesUrl) openInExternalBrowser(customerPicturesUrl)
              else showToast(TOAST_NO_CUSTOMER_PICTURES, 'warning', undefined, undefined, 'center')
            }}
            aria-label={
              jobLinksLoading
                ? 'Loading Customer Pictures link'
                : customerPicturesUrl
                  ? 'Open Customer Pictures link'
                  : 'Customer Pictures not linked; contact Dispatch'
            }
            title={
              jobLinksLoading
                ? 'Loading…'
                : customerPicturesUrl
                  ? 'Open Customer Pictures'
                  : TOAST_NO_CUSTOMER_PICTURES
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              padding: 0,
              border: `1px solid ${
                jobLinksLoading ? '#e5e7eb' : customerPicturesUrl ? '#c7d2fe' : '#fecaca'
              }`,
              borderRadius: 6,
              background: '#fff',
              cursor: jobLinksLoading ? 'not-allowed' : 'pointer',
              opacity: jobLinksLoading ? 0.85 : 1,
              color: jobLinksLoading ? '#9ca3af' : customerPicturesUrl ? '#2563eb' : '#dc2626',
            }}
          >
            <Images size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowJobReportsModal(true)}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#2563eb', background: 'none', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer', marginBottom: '1rem' }}
        >
          View my reports for this job
        </button>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Report type</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  style={reportTypeChipStyles(t.id, t.name)}
                >
                  {additionalReportModalTemplateChipLabel(t.name, userRole)}
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
                      id={`additional-report-pct-${f.id}`}
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
                      reactKeyPrefix={`add-${selectedTemplateId}-${f.id}`}
                      id={`additional-report-sig-${f.id}`}
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
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!canSubmit || saving} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Save report'}</button>
          </div>
        </form>
      </div>
    </div>
    {showJobReportsModal && (
      <JobReportsModal
        open={showJobReportsModal}
        onClose={() => setShowJobReportsModal(false)}
        jobId={jobId}
        hcpNumber={hcpNumber}
        jobName={jobName}
        jobAddress={jobAddress}
        authUserId={authUserId}
        userRole={userRole}
        filterCreatedByUserId={authUserId}
        zIndex={overlayZIndex + 5}
        onReportSaved={onReportSaved}
      />
    )}
    </>
  )
}
