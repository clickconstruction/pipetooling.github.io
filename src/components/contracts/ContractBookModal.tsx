import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { sanitizeContractSigningHtml } from '../../lib/sanitizeContractSigningHtml'
import { withSupabaseRetry } from '@/utils/errorHandling'

export type ContractBookTemplate = { id: string; name: string; sequence_order: number }

export type ContractBookTemplateDocument = {
  id: string
  template_id: string
  document_name: string
  sequence_order: number
  book_body_html: string | null
  tags: string[]
}

type ContractBookModalProps = {
  open: boolean
  onClose: () => void
  templates: ContractBookTemplate[]
  templateDocuments: ContractBookTemplateDocument[]
  onSaved: () => void
}

const badgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  backgroundColor: '#e5e7eb',
  color: '#374151',
  fontWeight: 500,
}

export function ContractBookModal({
  open,
  onClose,
  templates,
  templateDocuments,
  onSaved,
}: ContractBookModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editTagsStr, setEditTagsStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

  const sortedRows = useMemo(() => {
    return [...templateDocuments].sort((a, b) => {
      const ta = templateById.get(a.template_id)
      const tb = templateById.get(b.template_id)
      const order = (ta?.sequence_order ?? 0) - (tb?.sequence_order ?? 0)
      if (order !== 0) return order
      return a.sequence_order - b.sequence_order
    })
  }, [templateDocuments, templateById])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setViewingId(null)
      setEditBody('')
      setEditTagsStr('')
      setError(null)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, saving])

  function startEdit(row: ContractBookTemplateDocument) {
    setEditingId(row.id)
    setViewingId(null)
    setEditBody(row.book_body_html ?? '')
    setEditTagsStr((row.tags ?? []).join(', '))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
    setEditTagsStr('')
    setError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    setError(null)
    try {
      const sanitized = sanitizeContractSigningHtml(editBody)
      const tags = editTagsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await withSupabaseRetry(
        async () =>
          supabase
            .from('contract_template_documents')
            .update({
              book_body_html: sanitized.trim() ? sanitized : null,
              tags,
            })
            .eq('id', editingId)
            .select('id'),
        'update contract book entry',
      )
      onSaved()
      cancelEdit()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
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
        zIndex: 12,
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-book-title"
        style={{
          background: 'white',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 'min(96vw, 720px)',
          maxHeight: '90vh',
          overflow: 'auto',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
          <h3 id="contract-book-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            Contract Book
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Close
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p> : null}

        {sortedRows.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No template documents yet. Create templates and document names in Manage templates.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedRows.map((row) => {
              const tname = templateById.get(row.template_id)?.name ?? '—'
              const isEditing = editingId === row.id
              return (
                <li
                  key={row.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.75rem',
                    background: isEditing ? '#f9fafb' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.9375rem' }}>{row.document_name}</strong>
                    <span style={badgeStyle}>{tname}</span>
                    {(row.tags ?? []).map((tag) => (
                      <span key={tag} style={{ ...badgeStyle, backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        {tag}
                      </span>
                    ))}
                    {!isEditing ? (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          id={`contract-book-view-trigger-${row.id}`}
                          aria-expanded={viewingId === row.id}
                          aria-controls={`contract-book-view-${row.id}`}
                          onClick={() => setViewingId((v) => (v === row.id ? null : row.id))}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {viewingId === row.id && !isEditing ? (
                    <div
                      id={`contract-book-view-${row.id}`}
                      role="region"
                      aria-labelledby={`contract-book-view-trigger-${row.id}`}
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e5e7eb',
                        maxHeight: 320,
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {row.book_body_html?.trim() ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeContractSigningHtml(row.book_body_html ?? ''),
                          }}
                        />
                      ) : (
                        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>
                          No library body yet
                        </p>
                      )}
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={editTagsStr}
                          onChange={(e) => setEditTagsStr(e.target.value)}
                          placeholder="e.g. employment, NDA"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Library body (HTML or plain)</label>
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={10}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          style={{
                            padding: '0.4rem 0.85rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            background: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={saving}
                          style={{
                            padding: '0.4rem 0.85rem',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 6,
                            background: '#3b82f6',
                            color: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
