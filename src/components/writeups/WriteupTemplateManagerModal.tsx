import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  type WriteupTemplateBlock,
  emptyAnswersForSchema,
  parseWriteupTemplateSchema,
  schemaToJson,
} from '../../lib/writeupTemplateSchema'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { WriteupFormFields } from './WriteupFormFields'

export type WriteupTemplateRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  schema: unknown
  created_at: string
}

function newBlockId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function defaultBlocks(): WriteupTemplateBlock[] {
  return [
    {
      type: 'prompt',
      id: newBlockId(),
      content: 'Instructions: describe what the person completing this form should enter.',
    },
  ]
}

type Props = {
  open: boolean
  onClose: () => void
  templates: WriteupTemplateRow[]
  authUserId: string
  onAfterChange: () => void | Promise<void>
}

export function WriteupTemplateManagerModal({ open, onClose, templates, authUserId, onAfterChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [blocks, setBlocks] = useState<WriteupTemplateBlock[]>([])
  const [checklistNewOption, setChecklistNewOption] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!open) {
      setFormMode('none')
      setEditingId(null)
      setError(null)
    }
  }, [open])

  function openCreate() {
    setEditingId(null)
    setFormName('')
    setFormDescription('')
    setFormActive(true)
    setBlocks(defaultBlocks())
    setPreviewAnswers(emptyAnswersForSchema(defaultBlocks()))
    setFormMode('create')
    setError(null)
  }

  function openEdit(t: WriteupTemplateRow) {
    const parsed = parseWriteupTemplateSchema(t.schema)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setEditingId(t.id)
    setFormName(t.name)
    setFormDescription(t.description ?? '')
    setFormActive(t.is_active)
    setBlocks(parsed.schema)
    setPreviewAnswers(emptyAnswersForSchema(parsed.schema))
    setFormMode('edit')
    setError(null)
  }

  function closeForm() {
    setFormMode('none')
    setEditingId(null)
    setError(null)
  }

  useEffect(() => {
    if (formMode !== 'none') {
      setPreviewAnswers((prev) => {
        const next = emptyAnswersForSchema(blocks)
        for (const k of Object.keys(next)) {
          if (k in prev && typeof prev[k] === typeof next[k]) {
            ;(next as Record<string, unknown>)[k] = prev[k] as unknown
          }
        }
        return next
      })
    }
  }, [blocks, formMode])

  function moveBlock(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= blocks.length) return
    setBlocks((prev) => {
      const next = [...prev]
      const t = next[index]!
      next[index] = next[j]!
      next[j] = t
      return next
    })
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlock(kind: WriteupTemplateBlock['type']) {
    const id = newBlockId()
    if (kind === 'prompt') {
      setBlocks((prev) => [...prev, { type: 'prompt', id, content: 'New instruction text.' }])
      return
    }
    if (kind === 'text') {
      setBlocks((prev) => [...prev, { type: 'text', id, label: 'Question', required: false }])
      return
    }
    if (kind === 'textarea') {
      setBlocks((prev) => [...prev, { type: 'textarea', id, label: 'Details', required: false }])
      return
    }
    setBlocks((prev) => [...prev, { type: 'checklist', id, label: 'Check all that apply', options: ['Option A'], required: false }])
  }

  function updateBlock(index: number, patch: Partial<WriteupTemplateBlock>) {
    setBlocks((prev) => {
      const next = [...prev]
      const cur = next[index]
      if (!cur) return prev
      next[index] = { ...cur, ...patch } as WriteupTemplateBlock
      return next
    })
  }

  async function saveTemplate() {
    const name = formName.trim()
    if (!name) {
      setError('Template name is required.')
      return
    }
    const json = schemaToJson(blocks)
    const parsed = parseWriteupTemplateSchema(json)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (formMode === 'create') {
        await withSupabaseRetry(
          async () =>
            supabase.from('writeup_templates').insert({
              name,
              description: formDescription.trim() || null,
              schema: json,
              is_active: formActive,
              created_by: authUserId,
            }),
          'create writeup template'
        )
      } else if (editingId) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('writeup_templates')
              .update({
                name,
                description: formDescription.trim() || null,
                schema: json,
                is_active: formActive,
                updated_at: new Date().toISOString(),
              })
              .eq('id', editingId),
          'update writeup template'
        )
      }
      closeForm()
      await onAfterChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(t: WriteupTemplateRow) {
    if (!confirm(`Delete template "${t.name}"? Writeups that use it may block deletion.`)) return
    setError(null)
    try {
      await withSupabaseRetry(async () => supabase.from('writeup_templates').delete().eq('id', t.id), 'delete writeup template')
      await onAfterChange()
      if (editingId === t.id) closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete (template may be in use).')
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 440,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Manage writeup templates</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {error && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}

        {formMode !== 'none' ? (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{editingId ? 'Edit template' : 'New template'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                Active (inactive templates hidden when creating writeups)
              </label>

              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Fields</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                  {(['prompt', 'text', 'textarea', 'checklist'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => addBlock(k)}
                      style={{
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      + {k}
                    </button>
                  ))}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {blocks.map((b, i) => (
                    <li
                      key={b.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '0.65rem',
                        marginBottom: '0.5rem',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>{b.type}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button type="button" onClick={() => moveBlock(i, -1)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}>
                            Up
                          </button>
                          <button type="button" onClick={() => moveBlock(i, 1)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}>
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(i)}
                            style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', color: '#b91c1c' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {b.type === 'prompt' && (
                        <textarea
                          value={b.content}
                          onChange={(e) => updateBlock(i, { type: 'prompt', id: b.id, content: e.target.value })}
                          rows={2}
                          style={{ width: '100%', fontSize: '0.875rem' }}
                        />
                      )}
                      {(b.type === 'text' || b.type === 'textarea') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <input
                            type="text"
                            value={b.label}
                            placeholder="Label"
                            onChange={(e) =>
                              updateBlock(
                                i,
                                b.type === 'text'
                                  ? { type: 'text', id: b.id, label: e.target.value, required: b.required }
                                  : { type: 'textarea', id: b.id, label: e.target.value, required: b.required }
                              )
                            }
                          />
                          <label style={{ fontSize: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={!!b.required}
                              onChange={(e) =>
                                updateBlock(
                                  i,
                                  b.type === 'text'
                                    ? { type: 'text', id: b.id, label: b.label, required: e.target.checked }
                                    : { type: 'textarea', id: b.id, label: b.label, required: e.target.checked }
                                )
                              }
                            />{' '}
                            Required
                          </label>
                        </div>
                      )}
                      {b.type === 'checklist' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <input
                            type="text"
                            value={b.label ?? ''}
                            placeholder="Section label (optional)"
                            onChange={(e) => updateBlock(i, { type: 'checklist', id: b.id, options: b.options, label: e.target.value || undefined, required: b.required })}
                          />
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem' }}>
                            {b.options.map((opt, oi) => (
                              <li key={`${b.id}-${oi}`} style={{ marginBottom: '0.25rem' }}>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...b.options]
                                    next[oi] = e.target.value
                                    updateBlock(i, { type: 'checklist', id: b.id, options: next, label: b.label, required: b.required })
                                  }}
                                  style={{ width: '90%' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = b.options.filter((_, j) => j !== oi)
                                    if (next.length) updateBlock(i, { type: 'checklist', id: b.id, options: next, label: b.label, required: b.required })
                                  }}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <input
                              type="text"
                              placeholder="New option"
                              value={checklistNewOption[b.id] ?? ''}
                              onChange={(e) => setChecklistNewOption((p) => ({ ...p, [b.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const n = (checklistNewOption[b.id] ?? '').trim()
                                if (!n) return
                                updateBlock(i, { type: 'checklist', id: b.id, options: [...b.options, n], label: b.label, required: b.required })
                                setChecklistNewOption((p) => ({ ...p, [b.id]: '' }))
                              }}
                            >
                              Add option
                            </button>
                          </div>
                          <label style={{ fontSize: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={!!b.required}
                              onChange={(e) =>
                                updateBlock(i, { type: 'checklist', id: b.id, options: b.options, label: b.label, required: e.target.checked })
                              }
                            />{' '}
                            Require at least one checked
                          </label>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>Preview</div>
                <div style={{ border: '1px dashed #d1d5db', borderRadius: 6, padding: '0.75rem' }}>
                  <WriteupFormFields schema={blocks} answers={previewAnswers} onChange={setPreviewAnswers} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={saveTemplate}
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
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Templates</h4>
            <button
              type="button"
              onClick={openCreate}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              + New template
            </button>
          </div>
          {templates.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No writeup templates yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {templates.map((t) => (
                <li
                  key={t.id}
                  style={{
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    background: '#f9fafb',
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong>{t.name}</strong>
                    {!t.is_active && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#6b7280' }}>(inactive)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
