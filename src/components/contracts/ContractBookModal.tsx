import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '@/utils/errorHandling'
import {
  type ContractBodyFormat,
  normalizeContractBodyForSave,
  parseContractBodyFormat,
} from '../../lib/contractBodyFormat'
import { ContractBodyDisplay } from './ContractBodyDisplay'

export type ContractBookTemplate = { id: string; name: string; sequence_order: number }

export type ContractBookTemplateDocument = {
  id: string
  template_id: string
  document_name: string
  sequence_order: number
  book_body_html: string | null
  book_body_format: string
  tags: string[]
  canonical_document_url?: string | null
}

type ContractBookModalProps = {
  open: boolean
  onClose: () => void
  templates: ContractBookTemplate[]
  templateDocuments: ContractBookTemplateDocument[]
  onSaved: () => void
  /** When set (e.g. from People “Add document”), rows offer “Load into form” to copy library body into the parent form. */
  onPickEntry?: (entry: ContractBookTemplateDocument) => void
}

const badgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  backgroundColor: '#e5e7eb',
  color: '#374151',
  fontWeight: 500,
}

function parseCommaTags(tagsStr: string): string[] {
  return tagsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function BookBodyFormatToggle({
  value,
  onChange,
  disabled,
}: {
  value: ContractBodyFormat
  onChange: (v: ContractBodyFormat) => void
  disabled?: boolean
}) {
  const btn = (active: boolean) =>
    ({
      padding: '0.25rem 0.55rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      border: '1px solid #d1d5db',
      borderRadius: 6,
      background: active ? '#eff6ff' : '#fff',
      color: active ? '#1d4ed8' : '#374151',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }) as const

  return (
    <div
      role="group"
      aria-label="Library body format"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.35rem' }}
    >
      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Format:</span>
      <button type="button" style={btn(value === 'html')} disabled={disabled} onClick={() => onChange('html')}>
        HTML
      </button>
      <button type="button" style={btn(value === 'plain')} disabled={disabled} onClick={() => onChange('plain')}>
        Plain text
      </button>
      <button type="button" style={btn(value === 'markdown')} disabled={disabled} onClick={() => onChange('markdown')}>
        Markdown
      </button>
    </div>
  )
}

export function ContractBookModal({
  open,
  onClose,
  templates,
  templateDocuments,
  onSaved,
  onPickEntry,
}: ContractBookModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editDocumentName, setEditDocumentName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editTagsStr, setEditTagsStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [addTemplateId, setAddTemplateId] = useState('')
  const [addDocumentName, setAddDocumentName] = useState('')
  const [addTagsStr, setAddTagsStr] = useState('')
  const [addCanonicalUrl, setAddCanonicalUrl] = useState('')
  const [editCanonicalUrl, setEditCanonicalUrl] = useState('')
  const [addBody, setAddBody] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editBookFormat, setEditBookFormat] = useState<ContractBodyFormat>('html')
  const [addBookFormat, setAddBookFormat] = useState<ContractBodyFormat>('html')
  const [deleting, setDeleting] = useState(false)
  const [bookEntryDeleteConfirmOpen, setBookEntryDeleteConfirmOpen] = useState(false)

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

  const editingRow = useMemo(
    () => (editingId ? templateDocuments.find((d) => d.id === editingId) : undefined),
    [editingId, templateDocuments],
  )

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const o = a.sequence_order - b.sequence_order
      if (o !== 0) return o
      return a.name.localeCompare(b.name)
    })
  }, [templates])

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
      setEditDocumentName('')
      setEditBody('')
      setEditTagsStr('')
      setError(null)
      setSaving(false)
      setAddPanelOpen(false)
      setAddTemplateId('')
      setAddDocumentName('')
      setAddTagsStr('')
      setAddCanonicalUrl('')
      setEditCanonicalUrl('')
      setAddBody('')
      setAddSaving(false)
      setEditBookFormat('html')
      setAddBookFormat('html')
      setDeleting(false)
      setBookEntryDeleteConfirmOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (bookEntryDeleteConfirmOpen) {
        e.preventDefault()
        setBookEntryDeleteConfirmOpen(false)
        return
      }
      if (!saving && !addSaving && !deleting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, saving, addSaving, deleting, bookEntryDeleteConfirmOpen])

  function nextSequenceOrder(templateId: string): number {
    let max = -1
    for (const d of templateDocuments) {
      if (d.template_id === templateId && d.sequence_order > max) {
        max = d.sequence_order
      }
    }
    return max + 1
  }

  function cancelAdd() {
    setBookEntryDeleteConfirmOpen(false)
    setAddPanelOpen(false)
    setAddTemplateId('')
    setAddDocumentName('')
    setAddTagsStr('')
    setAddCanonicalUrl('')
    setAddBody('')
    setAddBookFormat('html')
    setError(null)
  }

  function openAddPanel() {
    setBookEntryDeleteConfirmOpen(false)
    setAddPanelOpen(true)
    setError(null)
    setAddTemplateId(sortedTemplates[0]?.id ?? '')
    setAddDocumentName('')
    setAddTagsStr('')
    setAddCanonicalUrl('')
    setAddBody('')
    setAddBookFormat('html')
    setEditingId(null)
    setViewingId(null)
  }

  function startEdit(row: ContractBookTemplateDocument) {
    setBookEntryDeleteConfirmOpen(false)
    setEditingId(row.id)
    setViewingId(null)
    setEditDocumentName(row.document_name)
    setEditBody(row.book_body_html ?? '')
    setEditBookFormat(parseContractBodyFormat(row.book_body_format))
    setEditTagsStr((row.tags ?? []).join(', '))
    setEditCanonicalUrl(row.canonical_document_url?.trim() ?? '')
    setError(null)
    setAddPanelOpen(false)
  }

  function cancelEdit() {
    setBookEntryDeleteConfirmOpen(false)
    setEditingId(null)
    setEditDocumentName('')
    setEditBody('')
    setEditTagsStr('')
    setEditCanonicalUrl('')
    setEditBookFormat('html')
    setError(null)
  }

  async function deleteBookEntry() {
    if (!editingId) return
    setDeleting(true)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('contract_template_documents').delete().eq('id', editingId),
        'delete contract book entry',
      )
      setBookEntryDeleteConfirmOpen(false)
      setViewingId((v) => (v === editingId ? null : v))
      onSaved()
      cancelEdit()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function saveEdit() {
    if (!editingId || !editingRow) return
    const trimmedName = editDocumentName.trim()
    if (!trimmedName) {
      setError('Enter a document name.')
      return
    }
    const dup = templateDocuments.some(
      (d) =>
        d.id !== editingId &&
        d.template_id === editingRow.template_id &&
        d.document_name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
    if (dup) {
      setError('A document with this name already exists for that template.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const bodyStored = normalizeContractBodyForSave(editBody, editBookFormat)
      const tags = parseCommaTags(editTagsStr)
      await withSupabaseRetry(
        () =>
          supabase.rpc('update_contract_book_entry', {
            p_contract_template_document_id: editingId,
            p_document_name: trimmedName,
            p_book_body_html: bodyStored ?? '',
            p_book_body_format: editBookFormat,
            p_tags: tags,
            p_canonical_document_url: editCanonicalUrl.trim(),
          }),
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

  async function saveNew() {
    const templateId = addTemplateId.trim()
    const docName = addDocumentName.trim()
    if (!templateId || !docName) {
      setError('Choose a template and enter a document name.')
      return
    }
    const dup = templateDocuments.some(
      (d) =>
        d.template_id === templateId && d.document_name.trim().toLowerCase() === docName.toLowerCase(),
    )
    if (dup) {
      setError('A document with this name already exists for that template.')
      return
    }
    setAddSaving(true)
    setError(null)
    try {
      const bodyStored = normalizeContractBodyForSave(addBody, addBookFormat)
      const tags = parseCommaTags(addTagsStr)
      const seq = nextSequenceOrder(templateId)
      const canonStored = addCanonicalUrl.trim() || null
      const inserted = await withSupabaseRetry<ContractBookTemplateDocument | null>(
        async () =>
          supabase
            .from('contract_template_documents')
            .insert({
              template_id: templateId,
              document_name: docName,
              sequence_order: seq,
              book_body_html: bodyStored,
              book_body_format: addBookFormat,
              tags,
              canonical_document_url: canonStored,
            })
            .select(
              'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url',
            )
            .single(),
        'add contract book entry',
      )
      if (!inserted) {
        setError('Could not create entry.')
        return
      }
      onSaved()
      cancelAdd()
      startEdit({
        ...inserted,
        tags: inserted.tags ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setAddSaving(false)
    }
  }

  if (!open) return null

  const busy = saving || addSaving || deleting

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '0.5rem',
          }}
        >
          <h3 id="contract-book-title" style={{ margin: 0, fontSize: '1.125rem', justifySelf: 'start' }}>
            Contract Book
          </h3>
          <div style={{ justifySelf: 'center' }}>
            {templates.length > 0 && !addPanelOpen ? (
              <button
                type="button"
                onClick={openAddPanel}
                disabled={busy}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  border: 'none',
                  borderRadius: 6,
                  background: '#059669',
                  color: '#fff',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Add Contract
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (bookEntryDeleteConfirmOpen) setBookEntryDeleteConfirmOpen(false)
              else onClose()
            }}
            disabled={busy}
            style={{
              justifySelf: 'end',
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Close
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p> : null}

        {onPickEntry ? (
          <p
            style={{
              fontSize: '0.8125rem',
              color: '#4b5563',
              marginTop: 0,
              marginBottom: '0.75rem',
              lineHeight: 1.45,
            }}
          >
            Select a library entry and use <strong>Load into form</strong> to fill the document you were editing.
          </p>
        ) : null}

        {templates.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            No contract templates yet. Create a template in <strong>Manage templates</strong> first, then you can add library entries here.
          </p>
        ) : null}

        {templates.length > 0 && addPanelOpen ? (
          <div
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '0.85rem',
              marginBottom: '1rem',
              background: '#f9fafb',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.65rem' }}>New library entry</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Template</label>
                <select
                  value={addTemplateId}
                  onChange={(e) => setAddTemplateId(e.target.value)}
                  disabled={addSaving}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                    fontSize: '0.875rem',
                  }}
                >
                  {sortedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Document name</label>
                <input
                  type="text"
                  value={addDocumentName}
                  onChange={(e) => setAddDocumentName(e.target.value)}
                  disabled={addSaving}
                  placeholder="e.g. Non-disclosure agreement"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Canonical document URL (optional)
                </label>
                <input
                  type="url"
                  value={addCanonicalUrl}
                  onChange={(e) => setAddCanonicalUrl(e.target.value)}
                  disabled={addSaving}
                  placeholder="https://… (Doc or PDF)"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={addTagsStr}
                  onChange={(e) => setAddTagsStr(e.target.value)}
                  disabled={addSaving}
                  placeholder="e.g. employment, NDA"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Library body (optional)
                </label>
                <BookBodyFormatToggle value={addBookFormat} onChange={setAddBookFormat} disabled={addSaving} />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
                  <strong>HTML:</strong> rich text (sanitized). <strong>Plain:</strong> exact text including angle brackets.{' '}
                  <strong>Markdown:</strong> rendered on the signing page (then sanitized).
                </p>
                <textarea
                  value={addBody}
                  onChange={(e) => setAddBody(e.target.value)}
                  disabled={addSaving}
                  rows={8}
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
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => cancelAdd()}
                    disabled={addSaving}
                    style={{
                      padding: '0.4rem 0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      background: '#fff',
                      cursor: addSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }} aria-hidden={true} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void saveNew()}
                    disabled={addSaving}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 6,
                      background: '#3b82f6',
                      color: '#fff',
                      cursor: addSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {addSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {templates.length > 0 && sortedRows.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            No library entries yet. Use <strong>Add Contract</strong> above, or add document names in Manage templates.
          </p>
        ) : null}

        {sortedRows.length === 0 ? null : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedRows.map((row) => {
              const tname = templateById.get(row.template_id)?.name ?? '—'
              const isEditing = editingId === row.id
              const hasLibraryBody = Boolean(row.book_body_html?.trim())
              const hasCanonicalUrl = Boolean(row.canonical_document_url?.trim())
              const hasLoadableContent = hasLibraryBody || hasCanonicalUrl
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
                    {hasCanonicalUrl ? (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 4,
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontWeight: 600,
                        }}
                      >
                        Link
                      </span>
                    ) : null}
                    {!isEditing ? (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {onPickEntry ? (
                          <button
                            type="button"
                            disabled={!hasLoadableContent}
                            title={
                              hasLoadableContent
                                ? undefined
                                : 'Add library body or canonical document URL to load into the form'
                            }
                            onClick={() => onPickEntry(row)}
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              border: 'none',
                              borderRadius: 6,
                              background: hasLoadableContent ? '#7c3aed' : '#e5e7eb',
                              color: hasLoadableContent ? '#fff' : '#9ca3af',
                              cursor: hasLoadableContent ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Load into form
                          </button>
                        ) : null}
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
                        <ContractBodyDisplay
                          format={row.book_body_format}
                          bodyHtml={row.book_body_html}
                          scrollStyles={{ maxHeight: 280 }}
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
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Document name</label>
                        <input
                          type="text"
                          value={editDocumentName}
                          onChange={(e) => setEditDocumentName(e.target.value)}
                          disabled={saving}
                          placeholder="e.g. Non-disclosure agreement"
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          Canonical document URL (optional)
                        </label>
                        <input
                          type="url"
                          value={editCanonicalUrl}
                          onChange={(e) => setEditCanonicalUrl(e.target.value)}
                          disabled={saving}
                          placeholder="https://… (Doc or PDF)"
                          autoComplete="off"
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            boxSizing: 'border-box',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
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
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          Library body
                        </label>
                        <BookBodyFormatToggle
                          value={editBookFormat}
                          onChange={setEditBookFormat}
                          disabled={saving}
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
                          <strong>HTML:</strong> rich text (sanitized). <strong>Plain:</strong> exact text including angle brackets.{' '}
                          <strong>Markdown:</strong> rendered on the signing page (then sanitized).
                        </p>
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
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving || deleting}
                            style={{
                              padding: '0.4rem 0.85rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              background: '#fff',
                              cursor: saving || deleting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setBookEntryDeleteConfirmOpen(true)}
                            disabled={saving || deleting}
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontWeight: 600,
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              background: '#fef2f2',
                              color: '#b91c1c',
                              cursor: saving || deleting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            disabled={saving || deleting}
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontWeight: 600,
                              border: 'none',
                              borderRadius: 6,
                              background: '#3b82f6',
                              color: '#fff',
                              cursor: saving || deleting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {bookEntryDeleteConfirmOpen && editingId ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 13,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBookEntryDeleteConfirmOpen(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="contract-book-delete-title"
            aria-describedby="contract-book-delete-desc"
            style={{
              background: 'white',
              padding: '1.25rem',
              borderRadius: 8,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 id="contract-book-delete-title" style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
              Delete library entry?
            </h4>
            <p
              id="contract-book-delete-desc"
              style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.45 }}
            >
              Delete <strong>{editingRow?.document_name ?? 'this entry'}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setBookEntryDeleteConfirmOpen(false)}
                disabled={deleting}
                style={{
                  padding: '0.4rem 0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteBookEntry()}
                disabled={deleting}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  background: deleting ? '#9ca3af' : '#dc2626',
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
