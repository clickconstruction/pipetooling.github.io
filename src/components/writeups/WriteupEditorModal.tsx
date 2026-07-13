import { useEffect, useMemo, useState } from 'react'
import type { Database, Json } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import {
  emptyAnswersForSchema,
  parseWriteupTemplateSchema,
  type WriteupAnswers,
  validateWriteupAnswers,
  type WriteupTemplateBlock,
} from '../../lib/writeupTemplateSchema'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { WriteupFormFields } from './WriteupFormFields'

export type WriteupListRow = {
  id: string
  template_id: string
  template_name: string
  subject_user_id: string
  subject_name: string
  filled_by_user_id: string
  author_name: string
  status: 'draft' | 'submitted'
  disclosure: Database['public']['Enums']['writeup_disclosure'] | null
  submitted_at: string | null
  created_at: string
  answers: unknown
}

type TemplateOption = {
  id: string
  name: string
  schema: unknown
  is_active: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit_draft' | 'view_submitted'
  row: WriteupListRow | null
  templates: TemplateOption[]
  userOptions: SearchableSelectOption[]
  authUserId: string
  onAfterSave: () => void | Promise<void>
}

export function WriteupEditorModal({ open, onClose, mode, row, templates, userOptions, authUserId, onAfterSave }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [subjectUserId, setSubjectUserId] = useState('')
  const [answers, setAnswers] = useState<WriteupAnswers>({})
  const [disclosure, setDisclosure] = useState<Database['public']['Enums']['writeup_disclosure'] | ''>('')
  const [localId, setLocalId] = useState<string | null>(null)

  const templateSelectOptions = useMemo(() => {
    if (mode === 'edit_draft' || mode === 'view_submitted') {
      const allowId = row?.template_id
      return templates
        .filter((t) => t.is_active || t.id === allowId)
        .map((t) => ({ value: t.id, label: t.name }))
    }
    return templates.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }))
  }, [mode, row?.template_id, templates])

  const schemaBlocks = useMemo((): WriteupTemplateBlock[] => {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return []
    const p = parseWriteupTemplateSchema(t.schema)
    return p.ok ? p.schema : []
  }, [templates, templateId])

  useEffect(() => {
    if (!open) {
      setError(null)
      setSaving(false)
      return
    }
    if (mode === 'create') {
      setTemplateId('')
      setSubjectUserId('')
      setAnswers({})
      setDisclosure('')
      setLocalId(null)
      return
    }
    if (row) {
      setTemplateId(row.template_id)
      setSubjectUserId(row.subject_user_id)
      setLocalId(row.id)
      const p = parseWriteupTemplateSchema(templates.find((t) => t.id === row.template_id)?.schema ?? [])
      const base = p.ok ? emptyAnswersForSchema(p.schema) : {}
      const merged = { ...base, ...(typeof row.answers === 'object' && row.answers !== null ? (row.answers as Record<string, unknown>) : {}) }
      setAnswers(merged)
      setDisclosure(row.disclosure ?? '')
    }
  }, [open, mode, row, templates])

  useEffect(() => {
    if (!open || mode !== 'create' || localId) return
    if (!templateId) return
    const t = templates.find((x) => x.id === templateId)
    const p = t ? parseWriteupTemplateSchema(t.schema) : null
    if (p?.ok) setAnswers(emptyAnswersForSchema(p.schema))
  }, [open, mode, localId, templateId, templates])

  const readOnly = mode === 'view_submitted'
  const lockMeta = mode !== 'create' || localId !== null

  async function saveDraft() {
    setError(null)
    if (!templateId || !subjectUserId) {
      setError('Choose a template and subject.')
      return
    }
    const p = parseWriteupTemplateSchema(templates.find((t) => t.id === templateId)?.schema ?? [])
    if (!p.ok) {
      setError(p.error)
      return
    }
    setSaving(true)
    try {
      const validated = validateWriteupAnswers(p.schema, answers, { enforceRequired: false })
      if (!validated.ok) {
        setError(validated.errors.join(' '))
        setSaving(false)
        return
      }
      if (!localId) {
        const ins = await withSupabaseRetry(
          async () =>
            supabase
              .from('writeups')
              .insert({
                template_id: templateId,
                subject_user_id: subjectUserId,
                filled_by_user_id: authUserId,
                status: 'draft',
                answers: validated.answers as Json,
              })
              .select('id')
              .single(),
          'insert writeup draft'
        )
        if (!ins || typeof ins !== 'object' || !('id' in ins) || typeof (ins as { id: unknown }).id !== 'string') {
          throw new Error('No id returned')
        }
        setLocalId((ins as { id: string }).id)
      } else {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('writeups')
              .update({
                answers: validated.answers as Json,
                updated_at: new Date().toISOString(),
              })
              .eq('id', localId)
              .eq('status', 'draft'),
          'update writeup draft'
        )
      }
      await onAfterSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  async function submitWriteup() {
    setError(null)
    if (!templateId || !subjectUserId) {
      setError('Choose a template and subject.')
      return
    }
    if (!disclosure) {
      setError('Select whether this was discussed with the subject or withheld.')
      return
    }
    const p = parseWriteupTemplateSchema(templates.find((t) => t.id === templateId)?.schema ?? [])
    if (!p.ok) {
      setError(p.error)
      return
    }
    const validated = validateWriteupAnswers(p.schema, answers)
    if (!validated.ok) {
      setError(validated.errors.join(' '))
      return
    }
    setSaving(true)
    try {
      const submittedAt = new Date().toISOString()
      if (!localId) {
        await withSupabaseRetry(
          async () =>
            supabase.from('writeups').insert({
              template_id: templateId,
              subject_user_id: subjectUserId,
              filled_by_user_id: authUserId,
              status: 'submitted',
              disclosure,
              answers: validated.answers as Json,
              submitted_at: submittedAt,
            }),
          'insert writeup submitted'
        )
      } else {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('writeups')
              .update({
                status: 'submitted',
                disclosure,
                answers: validated.answers as Json,
                submitted_at: submittedAt,
                updated_at: submittedAt,
              })
              .eq('id', localId)
              .eq('status', 'draft'),
          'submit writeup'
        )
      }
      onClose()
      await onAfterSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 420,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
            {mode === 'create' && !localId ? 'New writeup' : null}
            {mode === 'create' && localId ? 'Edit draft' : null}
            {mode === 'edit_draft' ? 'Edit draft' : null}
            {mode === 'view_submitted' ? 'Writeup (submitted)' : null}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>Template</label>
          <SearchableSelect
            value={templateId}
            onChange={setTemplateId}
            options={templateSelectOptions}
            placeholder="Select template…"
            disabled={readOnly || lockMeta}
            listAriaLabel="Templates"
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>Subject (user this writeup is about)</label>
          <SearchableSelect
            value={subjectUserId}
            onChange={setSubjectUserId}
            options={userOptions}
            placeholder="Select person…"
            disabled={readOnly || lockMeta}
            listAriaLabel="Subject users"
          />
        </div>

        {schemaBlocks.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <WriteupFormFields schema={schemaBlocks} answers={answers} onChange={setAnswers} readOnly={readOnly} disabled={saving} />
          </div>
        )}

        {!readOnly && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 6 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Disclosure (required to submit)</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              <input type="radio" name="wdisclosure" checked={disclosure === 'discussed_with_subject'} onChange={() => setDisclosure('discussed_with_subject')} />
              Discussed with subject
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              <input type="radio" name="wdisclosure" checked={disclosure === 'withheld_from_subject'} onChange={() => setDisclosure('withheld_from_subject')} />
              Withheld from subject
            </label>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              This flag is stored with the writeup for your records. Subjects do not see writeups in the app in this version.
            </p>
          </div>
        )}

        {readOnly && row?.disclosure && (
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            <strong>Disclosure:</strong>{' '}
            {row.disclosure === 'discussed_with_subject' ? 'Discussed with subject' : 'Withheld from subject'}
          </p>
        )}

        {!readOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={submitWriteup}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)' }}>
              Cancel
            </button>
          </div>
        )}

        {readOnly && (
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)' }}>
            Close
          </button>
        )}
      </div>
    </div>
  )
}
