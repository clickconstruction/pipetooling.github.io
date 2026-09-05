import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNarrowViewport660 } from '../../hooks/useNarrowViewport660'
import {
  bookVersionDateIsCustom,
  effectiveBookVersionLabel,
  effectiveBookVersionPlainDate,
} from '../../lib/contractBookVersionDate'
import { todayPlainDateInAppTz } from '../../lib/personContractAppliedDate'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '@/utils/errorHandling'
import {
  type ContractBodyFormat,
  contractBodyHasRenderableDisplay,
  normalizeContractBodyForSave,
  parseContractBodyFormat,
} from '../../lib/contractBodyFormat'
import { openContractBookEntryPreview } from '../../lib/contractBookPreview'
import { ContractBodyDisplay } from './ContractBodyDisplay'

export type ContractBookTemplate = { id: string; name: string; sequence_order: number }

export type ContractBookTemplateDocument = {
  updated_at?: string | null
  book_version_date?: string | null
  audience?: string | null
  /** Contract Forms (v2.2794): set = this entry is a fillable form; the signer fills the template's PDF. */
  form_template_id?: string | null
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
  /** When false, library entry Delete is hidden (e.g. People Contracts assistants). Default true. */
  canDeleteLibraryEntries?: boolean
  /** Render only the content (no overlay/title/Close) — the Contract library modal's Documents tab (v2.1411). */
  embedded?: boolean
  /** Document name → people with a copy; renders "sent to N people" on each entry (v2.1411). */
  sentCountByDocName?: ReadonlyMap<string, number>
  /** Per-entry "Send to…" quick-send hook (v2.1411). */
  onQuickSend?: (documentName: string) => void
}

const badgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  backgroundColor: 'var(--bg-200)',
  color: 'var(--text-700)',
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
      border: '1px solid var(--border-strong)',
      borderRadius: 6,
      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
      color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }) as const

  return (
    <div
      role="group"
      aria-label="Library body format"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.35rem' }}
    >
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Format:</span>
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
  canDeleteLibraryEntries = true,
  embedded = false,
  sentCountByDocName,
  onQuickSend,
}: ContractBookModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editDocumentName, setEditDocumentName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editTagsStr, setEditTagsStr] = useState('')
  const [editAudience, setEditAudience] = useState<'staff' | 'customer' | 'sub'>('staff')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [addTemplateId, setAddTemplateId] = useState('')
  const [addDocumentName, setAddDocumentName] = useState('')
  const [addTagsStr, setAddTagsStr] = useState('')
  const [addAudience, setAddAudience] = useState<'staff' | 'customer' | 'sub'>('staff')
  const [addCanonicalUrl, setAddCanonicalUrl] = useState('')
  const [editCanonicalUrl, setEditCanonicalUrl] = useState('')
  const [addBody, setAddBody] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editBookFormat, setEditBookFormat] = useState<ContractBodyFormat>('html')
  const [addBookFormat, setAddBookFormat] = useState<ContractBodyFormat>('html')
  /** Empty string = version date follows the last edit; 'YYYY-MM-DD' = custom stored date. */
  const [editVersionDate, setEditVersionDate] = useState('')
  const [addVersionDate, setAddVersionDate] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [bookEntryDeleteConfirmOpen, setBookEntryDeleteConfirmOpen] = useState(false)
  /** Phones (v2.1413): title on its own line, chips under it, centered action row — the inline header wraps raggedly there. */
  const narrowViewport = useNarrowViewport660()

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
    if (!open || embedded) return
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
  }, [open, embedded, onClose, saving, addSaving, deleting, bookEntryDeleteConfirmOpen])

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
    setAddVersionDate('')
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
    setAddVersionDate('')
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
    setEditAudience(row.audience === 'customer' ? 'customer' : row.audience === 'sub' ? 'sub' : 'staff')
    setEditCanonicalUrl(row.canonical_document_url?.trim() ?? '')
    setEditVersionDate(row.book_version_date ?? '')
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
    setEditVersionDate('')
    setError(null)
  }

  async function deleteBookEntry() {
    if (!canDeleteLibraryEntries) return
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
      setError('A document with this name already exists for that packet.')
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
            // null clears the date (omission hits the keep-current sentinel); the generated Args type drops `| null`.
            p_book_version_date: (editVersionDate.trim() || null) as unknown as string,
          }),
        'update contract book entry',
      )
      // Audience (Contract Desk): staff packets vs customer job-contract templates — a plain column, not part of the RPC.
      await withSupabaseRetry(
        () => supabase.from('contract_template_documents').update({ audience: editAudience }).eq('id', editingId!),
        'update contract book entry audience',
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
      setError('A document with this name already exists for that packet.')
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
              audience: addAudience,
              book_version_date: addVersionDate.trim() || null,
            })
            .select(
              'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url, updated_at, book_version_date, audience',
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

  const addContractButton =
    templates.length > 0 && !addPanelOpen ? (
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
    ) : null

  const body = (
    <>
        {embedded ? (
          addContractButton ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>{addContractButton}</div>
          ) : null
        ) : (
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
          <div style={{ justifySelf: 'center' }}>{addContractButton}</div>
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
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Close
          </button>
        </div>
        )}
        {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p> : null}

        {onPickEntry ? (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-600)',
              marginTop: 0,
              marginBottom: '0.75rem',
              lineHeight: 1.45,
            }}
          >
            Select a library entry and use <strong>Load into form</strong> to fill the document you were editing.
          </p>
        ) : null}

        {templates.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            No packets yet. Create one on the <strong>Packets</strong> tab first, then you can add library documents here.
          </p>
        ) : null}

        {templates.length > 0 && addPanelOpen ? (
          <div
            style={{
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              padding: '0.85rem',
              marginBottom: '1rem',
              background: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.65rem' }}>New library entry</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Packet</label>
                <select
                  value={addTemplateId}
                  onChange={(e) => setAddTemplateId(e.target.value)}
                  disabled={addSaving}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border-strong)',
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
                    border: '1px solid var(--border-strong)',
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
                    border: '1px solid var(--border-strong)',
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Audience</label>
                <select value={addAudience} onChange={(e) => setAddAudience(e.target.value === 'customer' ? 'customer' : e.target.value === 'sub' ? 'sub' : 'staff')} disabled={addSaving} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }}>
                  <option value="staff">Staff — packets for people (default)</option>
                  <option value="customer">Customer — job-contract terms (Contract Desk)</option>
                  <option value="sub">Subs — General Conditions and exhibits every work order references</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Version date (optional — otherwise follows the last edit)
                </label>
                <input
                  type="date"
                  value={addVersionDate}
                  onChange={(e) => setAddVersionDate(e.target.value)}
                  disabled={addSaving}
                  style={{ padding: '0.375rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Library body (optional)
                </label>
                <BookBodyFormatToggle value={addBookFormat} onChange={setAddBookFormat} disabled={addSaving} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
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
                    border: '1px solid var(--border-strong)',
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      background: 'var(--surface)',
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            No library documents yet. Use <strong>Add Contract</strong> above.
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
              const canPreview = contractBodyHasRenderableDisplay(row.book_body_html, row.book_body_format)
              const entryChips = (
                <>
                    <span style={badgeStyle}>{tname}</span>
                    {row.audience === 'customer' ? (
                      <span style={{ ...badgeStyle, backgroundColor: 'var(--bg-orange-tint)', color: 'var(--text-orange-800)' }}>Customer contract</span>
                    ) : row.audience === 'sub' ? (
                      <span style={{ ...badgeStyle, backgroundColor: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>For subs</span>
                    ) : null}
                    {(row.tags ?? []).map((tag) => (
                      <span key={tag} style={{ ...badgeStyle, backgroundColor: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' }}>
                        {tag}
                      </span>
                    ))}
                    {hasCanonicalUrl ? (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 4,
                          backgroundColor: 'var(--bg-amber-100)',
                          color: 'var(--text-amber-800)',
                          fontWeight: 600,
                        }}
                      >
                        Link
                      </span>
                    ) : null}
                </>
              )
              const entryActions = !isEditing ? (
                      <div
                        style={
                          narrowViewport
                            ? { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }
                            : { justifySelf: 'end', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }
                        }
                      >
                        {onQuickSend && hasLoadableContent ? (
                          <button
                            type="button"
                            onClick={() => onQuickSend(row.document_name)}
                            title={`Send ${row.document_name} to a person`}
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              border: 'none',
                              borderRadius: 6,
                              background: '#0ea5e9',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            Send to…
                          </button>
                        ) : null}
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
                              background: hasLoadableContent ? '#7c3aed' : 'var(--bg-200)',
                              color: hasLoadableContent ? '#fff' : 'var(--text-faint)',
                              cursor: hasLoadableContent ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Load into form
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canPreview}
                          title={
                            canPreview
                              ? 'Open a full-page preview in a new tab'
                              : 'Add a library body to enable preview'
                          }
                          onClick={() => openContractBookEntryPreview(row)}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: canPreview ? 'var(--text-700)' : 'var(--text-faint)',
                            cursor: canPreview ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Preview
                        </button>
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
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            background: 'var(--surface)',
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
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      </div>
              ) : null
              // The version line (v2.2808): inline after the chips on desktop so it can flow under the
              // buttons; its own block on phones and while editing.
              const versionLabel = effectiveBookVersionLabel(row)
              const sentCount = sentCountByDocName?.get(row.document_name)
              const versionCustom = bookVersionDateIsCustom(row)
              const versionText =
                versionLabel || sentCount != null ? (
                  <>
                    {versionLabel ? (
                      <>
                        Version date:{' '}
                        <span
                          style={
                            versionCustom
                              ? { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }
                              : undefined
                          }
                        >
                          {versionLabel}
                        </span>
                        {versionCustom ? ' — set manually' : ''}
                      </>
                    ) : null}
                    {sentCount != null ? (
                      <>
                        {versionLabel ? ' · ' : ''}
                        {sentCount === 0 ? 'not sent to anyone yet' : `sent to ${sentCount} ${sentCount === 1 ? 'person' : 'people'}`}
                      </>
                    ) : null}
                  </>
                ) : null
              const versionBlock = versionText ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{versionText}</div>
              ) : null
              return (
                <li
                  key={row.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0.75rem',
                    background: isEditing ? 'var(--bg-subtle)' : 'var(--surface)',
                  }}
                >
                  {narrowViewport ? (
                    <div style={{ marginBottom: '0.35rem' }}>
                      <strong style={{ display: 'block', fontSize: '0.9375rem', overflowWrap: 'anywhere' }}>
                        {row.document_name}
                      </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                        {entryChips}
                      </div>
                      {entryActions}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '1rem', rowGap: '0.3rem', alignItems: 'start', marginBottom: '0.35rem' }}>
                      <strong style={{ fontSize: '0.9375rem', overflowWrap: 'anywhere', alignSelf: 'center' }}>{row.document_name}</strong>
                      {entryActions}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                        {entryChips}
                        {!isEditing && versionText ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.15rem' }}>· {versionText}</span> : null}
                      </div>
                    </div>
                  )}

                  {narrowViewport || isEditing ? versionBlock : null}

                  {viewingId === row.id && !isEditing ? (
                    <div
                      id={`contract-book-view-${row.id}`}
                      role="region"
                      aria-labelledby={`contract-book-view-trigger-${row.id}`}
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border)',
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
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', margin: 0, fontStyle: 'italic' }}>
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
                            border: '1px solid var(--border-strong)',
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
                            border: '1px solid var(--border-strong)',
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
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Audience</label>
                        <select value={editAudience} onChange={(e) => setEditAudience(e.target.value === 'customer' ? 'customer' : e.target.value === 'sub' ? 'sub' : 'staff')} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }}>
                          <option value="staff">Staff — packets for people (default)</option>
                          <option value="customer">Customer — job-contract terms (Contract Desk)</option>
                          <option value="sub">Subs — General Conditions and exhibits every work order references</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Version date</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div
                            role="group"
                            aria-label="Version date source"
                            style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}
                          >
                            <button
                              type="button"
                              aria-pressed={!editVersionDate}
                              disabled={saving}
                              onClick={() => setEditVersionDate('')}
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                border: 'none',
                                borderRadius: 0,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                background: !editVersionDate ? 'var(--bg-blue-tint)' : 'transparent',
                                color: !editVersionDate ? 'var(--text-blue-700)' : 'var(--text-muted)',
                              }}
                            >
                              From last edit
                            </button>
                            <button
                              type="button"
                              aria-pressed={!!editVersionDate}
                              disabled={saving}
                              onClick={() => {
                                if (editVersionDate) return
                                setEditVersionDate(
                                  effectiveBookVersionPlainDate({ updated_at: row.updated_at ?? null }) ??
                                    todayPlainDateInAppTz(),
                                )
                              }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                border: 'none',
                                borderRadius: 0,
                                borderLeft: '1px solid var(--border-strong)',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                background: editVersionDate ? 'var(--bg-blue-tint)' : 'transparent',
                                color: editVersionDate ? 'var(--text-blue-700)' : 'var(--text-muted)',
                              }}
                            >
                              Custom date
                            </button>
                          </div>
                          <input
                            type="date"
                            value={editVersionDate}
                            onChange={(e) => setEditVersionDate(e.target.value)}
                            disabled={saving || !editVersionDate}
                            aria-label="Custom version date"
                            style={{ padding: '0.375rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                          />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
                          {editVersionDate
                            ? 'Becomes this document’s official version date everywhere — the People → Contracts pickers and Applied version column. Editing the text won’t move it.'
                            : 'The version date follows the last edit to this library entry.'}
                        </p>
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
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
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
                            border: '1px solid var(--border-strong)',
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
                              border: '1px solid var(--border-strong)',
                              borderRadius: 6,
                              background: 'var(--surface)',
                              cursor: saving || deleting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                          {canDeleteLibraryEntries ? (
                            <button
                              type="button"
                              onClick={() => setBookEntryDeleteConfirmOpen(true)}
                              disabled={saving || deleting}
                              style={{
                                padding: '0.4rem 0.85rem',
                                fontWeight: 600,
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                background: 'var(--bg-red-tint)',
                                color: 'var(--text-red-700)',
                                cursor: saving || deleting ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          ) : null}
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
    </>
  )

  const deleteConfirm =
    bookEntryDeleteConfirmOpen && editingId && canDeleteLibraryEntries ? (
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
              background: 'var(--surface)',
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
              style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.45 }}
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
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--surface)',
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
      ) : null

  if (embedded) {
    return (
      <div>
        {body}
        {deleteConfirm}
      </div>
    )
  }

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
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-book-title"
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 'min(96vw, 720px)',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          width: '100%',
        }}
      >
        {body}
      </div>
      {deleteConfirm}
    </div>
  )
}
