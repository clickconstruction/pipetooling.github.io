import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import {
  fieldValueForSubmit,
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
  tryParsePercent0to100,
} from '../lib/reportTemplateFieldDisplay'
import { validateReportSignatureDataUrlForSubmit } from '../lib/reportSignatureField'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportTemplateSignatureField } from './ReportTemplateSignatureField'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../lib/stickyModalHeaderStyle'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import { useReportPhotos } from '../hooks/useReportPhotos'
import { ReportPhotoTiles } from './reports/ReportPhotoTiles'
import { ReportPhotosStrip } from './reports/ReportPhotosStrip'
import { REPORT_PHOTO_WORDS, newPhotoLine, reportEditSaveWords } from '../lib/photos/reportPhotos'

type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']

export type ReportForEdit = {
  id: string
  template_id: string
  template_name: string
  job_display_name: string
  created_at: string
  field_values?: Record<string, string>
  /** The ledger job (punch list #229, PR 4): the form takes more photos on a job's report; none on a project's or a bid's. */
  job_ledger_id?: string | null
}

type Props = {
  open: boolean
  report: ReportForEdit | null
  onClose: () => void
  onSaved: () => void
  viewerRole?: UserRole | null
}

export default function ReportEditModal({ open, report, onClose, onSaved, viewerRole }: Props) {
  const { profileName, user, role } = useAuth()
  // More photos on a saved report (punch list #229, PR 4): the same hook as the forms, with no stages; the ones
  // already on the report are drawn by the strip and stay, since Drive is their home.
  const phone = useNarrowViewport640()
  const photoJobId = open && report ? (report.job_ledger_id ?? null) : null
  const cameraFirst = phone && canLeaveJobFieldReport(role)
  const photos = useReportPhotos({ open: open && !!report, jobId: photoJobId, authUserId: user?.id ?? null, byName: profileName?.trim() || '', cameraFirst, stages: [] })
  const [templateFields, setTemplateFields] = useState<ReportTemplateField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !report) return
    supabase
      .from('report_template_fields')
      .select('*')
      .eq('template_id', report.template_id)
      .order('sequence_order')
      .then(({ data }) => {
        const fields = (data as ReportTemplateField[]) ?? []
        setTemplateFields(fields)
        const raw = (report.field_values ?? {}) as Record<string, string>
        const merged = { ...raw }
        if (merged[REPORT_FIELD_LABEL_JOB_COMPLETION] == null && merged[REPORT_FIELD_LABEL_LEGACY_WHO] != null) {
          merged[REPORT_FIELD_LABEL_JOB_COMPLETION] = merged[REPORT_FIELD_LABEL_LEGACY_WHO]
        }
        setFieldValues(merged)
      })
    setError(null)
  }, [open, report])

  function handleClose() {
    setError(null)
    photos.drop()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!report) return
    setSaving(true)
    setError(null)
    for (const f of templateFields) {
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
    for (const f of templateFields) {
      fv[f.label] = fieldValueForSubmit(f, fieldValues)
    }
    const { error: err } = await supabase
      .from('reports')
      .update({ field_values: fv, updated_at: new Date().toISOString() })
      .eq('id', report.id)
    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }
    // The photos added here ride with the report (PR 4), named by the first long field's words.
    if (photos.riding.length > 0) {
      const firstLong = templateFields.find((f) => (f.input_type ?? 'long_text') === 'long_text')?.label ?? null
      await photos.attach(report.id, firstLong ? (fv[firstLong] ?? '') : '')
    }
    setSaving(false)
    onSaved()
    handleClose()
  }

  // Freeze the page behind the modal — dragging inside it used to scroll the
  // list underneath on a phone, and closing then landed somewhere else.
  useBodyScrollLock(open)

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 760,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* This panel is the scroller — the title bar sticks so the × stays reachable
          on a phone instead of scrolling away once the form fills in (v2.990 pattern). */}
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
          ...stickyModalPanelStyle(560),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit report</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {displayReportTemplateName(report?.template_name ?? 'Report', viewerRole)} · {report?.job_display_name ?? 'Unknown job'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={STICKY_MODAL_CLOSE_BUTTON_STYLE}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {templateFields.length > 0 ? (
            <div style={{ marginBottom: '1rem' }}>
              {templateFields.map((f) => {
                const t = f.input_type ?? 'long_text'
                if (t === 'percent_0_100') {
                  const rawVal = fieldValues[f.label] ?? '0'
                  const showLegacy = tryParsePercent0to100(rawVal) === null && rawVal.trim() !== ''
                  return (
                    <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                      <ReportTemplatePercentField
                        id={`edit-report-pct-${f.id}`}
                        label={f.label}
                        value={rawVal}
                        onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.label]: v }))}
                      />
                      {showLegacy ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                          Previous answer: {rawVal}
                        </p>
                      ) : null}
                    </div>
                  )
                }
                if (t === 'signature_png') {
                  return (
                    <ReportTemplateSignatureField
                      key={f.id}
                      reactKeyPrefix={report ? `edit-${report.id}-${f.id}` : `edit-field-${f.id}`}
                      id={`edit-report-sig-${f.id}`}
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
          ) : (
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No fields to edit.</p>
          )}

          {/* The report's photos (punch list #229, PR 4): the saved ones as the card draws them, then the tile for more. */}
          {report ? (
            <div style={{ marginBottom: '1rem' }} data-testid="report-photos-block">
              <ReportPhotosStrip reportId={report.id} foot={photoJobId ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{REPORT_PHOTO_WORDS.savedStays}</span> : null} />
              {photoJobId ? (
                <>
                  <input {...photos.inputProps} />
                  {photos.lastShrink ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{newPhotoLine({ shrinkWords: photos.lastShrink, jobHasFolder: photos.jobHasFolder })}</div> : null}
                  <ReportPhotoTiles
                    tiles={photos.tiles}
                    stages={[]}
                    onTake={() => photos.openCamera(null)}
                    onStage={photos.putOnStage}
                    onRemove={photos.remove}
                    onRetry={photos.retry}
                    captureWords={cameraFirst ? (photos.tiles.length ? REPORT_PHOTO_WORDS.another : REPORT_PHOTO_WORDS.take) : REPORT_PHOTO_WORDS.add}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || photos.inFlight} style={{ padding: '0.5rem 1rem', background: saving || photos.inFlight ? DEAD_PRESS_FILL : '#2563eb', color: saving || photos.inFlight ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: saving || photos.inFlight ? 'not-allowed' : 'pointer' }}>
              {reportEditSaveWords({ tiles: photos.tiles, saving })}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
