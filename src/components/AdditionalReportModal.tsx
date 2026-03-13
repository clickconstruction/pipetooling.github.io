import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  authUserId: string | null
  userRole?: UserRole | null
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
}

export default function AdditionalReportModal({ open, onClose, onSaved, authUserId, userRole, jobId, hcpNumber, jobName, jobAddress }: Props) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateFields, setTemplateFields] = useState<Record<string, ReportTemplateField[]>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      const list = (data as ReportTemplate[]) ?? []
      setTemplates(list)
      if (list.length > 0) {
        const match = list.find((t) => t.name.toLowerCase() === 'note')
        setSelectedTemplateId(match?.id ?? list[0]!.id)
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
    const fv: Record<string, string> = {}
    for (const f of fields) {
      fv[f.label] = fieldValues[f.label] ?? ''
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
      const { data: reportId, error: rpcErr } = await supabase.rpc('insert_report', {
        p_template_id: selectedTemplateId,
        p_field_values: fv,
        p_job_ledger_id: jobId,
        p_project_id: null,
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
    onSaved()
    handleClose()
    if (inserted?.id) {
      try {
        await supabase.functions.invoke('send-report-notification', { body: { report_id: inserted.id } })
      } catch {
        // Non-blocking: report was created; notification is best-effort
      }
    }
  }

  if (!open) return null

  const fields = templateFields[selectedTemplateId] ?? []
  const canSubmit = selectedTemplateId && authUserId

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
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

        <form onSubmit={handleSubmit}>
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
                    border: selectedTemplateId === t.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    background: selectedTemplateId === t.id ? '#eff6ff' : 'white',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: selectedTemplateId === t.id ? 600 : 400,
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {fields.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {fields.map((f) => (
                <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{f.label}</label>
                  <textarea
                    value={fieldValues[f.label] ?? ''}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              ))}
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
  )
}
