import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']

export type ReportForEdit = {
  id: string
  template_id: string
  template_name: string
  job_display_name: string
  created_at: string
  field_values?: Record<string, string>
}

type Props = {
  open: boolean
  report: ReportForEdit | null
  onClose: () => void
  onSaved: () => void
}

export default function ReportEditModal({ open, report, onClose, onSaved }: Props) {
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
        setFieldValues((report.field_values ?? {}) as Record<string, string>)
      })
    setError(null)
  }, [open, report])

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!report) return
    setSaving(true)
    setError(null)
    const fv: Record<string, string> = {}
    for (const f of templateFields) {
      fv[f.label] = fieldValues[f.label] ?? ''
    }
    const { error: err } = await supabase
      .from('reports')
      .update({ field_values: fv, updated_at: new Date().toISOString() })
      .eq('id', report.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    handleClose()
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 400,
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit report</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {report?.template_name ?? 'Report'} · {report?.job_display_name ?? 'Unknown job'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {templateFields.length > 0 ? (
            <div style={{ marginBottom: '1rem' }}>
              {templateFields.map((f) => (
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
          ) : (
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No fields to edit.</p>
          )}

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: saving ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
