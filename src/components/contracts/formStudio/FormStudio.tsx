import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import type { ContractBookTemplate } from '../ContractBookModal'
import { emptyFormSchema } from '../../../lib/forms/formSchema'
import { readPdfFields, type FormPdfLibLike } from '../../../lib/forms/fillFormPdf'
import { mergeDraftedFields, schemaSummary } from '../../../lib/forms/formStudioState'
import { createFormTemplate, deleteFormTemplate, downloadTemplatePdf, listFormTemplates, type BookEntryLite, type FormTemplateRow } from '../../../lib/forms/formTemplateRepo'
import { FormStudioEditor } from './FormStudioEditor'

/**
 * Form Studio (Contract Forms PR 2) — the dev-only Forms tab of the Contract
 * library. Lists form templates, creates one from an uploaded PDF (importing
 * its fillable fields as boxes), and opens the editor.
 */

const DOC_TYPES: Array<{ v: string; l: string }> = [
  { v: 'w9', l: 'W-9' },
  { v: 'coi', l: 'COI' },
  { v: 'license', l: 'License' },
  { v: 'agreement', l: 'Agreement' },
  { v: 'other', l: 'Other' },
]

export function FormStudio({ packets, bookEntries, onSaved }: { packets: ContractBookTemplate[]; bookEntries: BookEntryLite[]; onSaved: () => void }) {
  const confirmDialog = useConfirmDialog()
  const [rows, setRows] = useState<FormTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRevision, setNewRevision] = useState('')
  const [newDocType, setNewDocType] = useState('w9')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newFieldCount, setNewFieldCount] = useState<number | null>(null)
  const [importFields, setImportFields] = useState(true)
  const [open, setOpen] = useState<{ row: FormTemplateRow; pdf: ArrayBuffer } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listFormTemplates())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function pickFile(file: File | null) {
    setNewFile(file)
    setNewFieldCount(null)
    if (!file) return
    try {
      const lib = (await import('pdf-lib')) as unknown as FormPdfLibLike
      const info = await readPdfFields(lib, await file.arrayBuffer())
      setNewFieldCount(info.fields.length)
      if (!newName.trim()) setNewName(file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function create() {
    if (!newFile || !newName.trim()) return
    setBusy('Creating…')
    setError(null)
    try {
      const bytes = await newFile.arrayBuffer()
      const lib = (await import('pdf-lib')) as unknown as FormPdfLibLike
      const info = await readPdfFields(lib, bytes)
      let schema = emptyFormSchema(info.pages)
      if (importFields && info.fields.length > 0) schema = mergeDraftedFields(schema, info.fields, info.pages).schema
      const { data: sess } = await supabase.auth.getSession()
      const row = await createFormTemplate({ name: newName, revisionLabel: newRevision, docType: newDocType, pdf: bytes, schema, createdBy: sess.session?.user.id ?? null })
      setRows((prev) => [row, ...prev])
      setCreating(false)
      setNewName('')
      setNewRevision('')
      setNewFile(null)
      setNewFieldCount(null)
      setOpen({ row, pdf: bytes })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function openRow(row: FormTemplateRow) {
    setBusy('Opening…')
    setError(null)
    try {
      const pdf = await downloadTemplatePdf(row.pdf_storage_path)
      setOpen({ row, pdf })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function remove(row: FormTemplateRow) {
    const entry = bookEntries.find((d) => d.form_template_id === row.id)
    const ok = await confirmDialog({
      title: `Delete "${row.name}"?`,
      message: entry ? `Its Contract Book entry "${entry.document_name}" stays but stops being a form; people's copies keep their signed PDFs. This cannot be undone.` : 'The uploaded PDF and its boxes are removed. This cannot be undone.',
      confirmLabel: 'Delete form',
      danger: true,
    })
    if (!ok) return
    setBusy('Deleting…')
    try {
      await deleteFormTemplate(row)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (open) {
    return (
      <FormStudioEditor
        row={open.row}
        pdf={open.pdf}
        packets={packets}
        bookEntries={bookEntries}
        onBack={() => {
          setOpen(null)
          void load()
        }}
        onSaved={(saved) => {
          setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
          setOpen((cur) => (cur ? { ...cur, row: saved } : cur))
          onSaved()
        }}
        onPdfReplaced={(saved, pdf) => {
          setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
          setOpen({ row: saved, pdf })
        }}
      />
    )
  }

  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 620 }}>
          A <strong>form</strong> is a document the signer fills in on the page itself: you upload the PDF, place the entry boxes where the answers go, and publish it as a Contract Book entry. Sensitive boxes (a Social Security number) live only inside the signed PDF, never on the person&rsquo;s row. Dev-only.
        </p>
        <button type="button" onClick={() => setCreating((v) => !v)} style={{ ...btn, marginLeft: 'auto', fontWeight: 700 }}>
          {creating ? 'Cancel' : '+ New form from a PDF'}
        </button>
      </div>

      {creating ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem 0.9rem', background: 'var(--surface)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', alignItems: 'end' }}>
          <label style={lbl}>
            PDF
            <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} style={{ display: 'block', fontSize: '0.8125rem', marginTop: '0.2rem' }} />
          </label>
          <label style={lbl}>
            Name
            <input style={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="W-9" />
          </label>
          <label style={lbl}>
            Revision
            <input style={inp} value={newRevision} onChange={(e) => setNewRevision(e.target.value)} placeholder="Rev. March 2024" />
          </label>
          <label style={lbl}>
            Paperwork type
            <select style={inp} value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.35rem' }}>
            <input type="checkbox" checked={importFields} onChange={(e) => setImportFields(e.target.checked)} disabled={newFieldCount === 0} />
            {newFieldCount == null ? 'Import the PDF’s fillable fields as boxes' : newFieldCount === 0 ? 'This PDF has no fillable fields — boxes are placed by hand' : `Import its ${newFieldCount} fillable field${newFieldCount === 1 ? '' : 's'} as boxes`}
          </label>
          <button type="button" onClick={() => void create()} disabled={!newFile || !newName.trim() || !!busy} style={{ ...btn, fontWeight: 700 }}>
            Create and open
          </button>
        </div>
      ) : null}

      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
      {busy ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{busy}</p> : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No forms yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rows.map((r) => {
            const s = schemaSummary(r.schema)
            const entry = bookEntries.find((d) => d.form_template_id === r.id)
            const packet = entry ? packets.find((p) => p.id === entry.template_id) : null
            return (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.7rem', background: 'var(--surface)', fontSize: '0.8125rem' }}>
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
                    {r.name} {r.revision_label ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {r.revision_label}</span> : null}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {DOC_TYPES.find((t) => t.v === r.doc_type)?.l ?? r.doc_type} · {r.page_count} page{r.page_count === 1 ? '' : 's'} · {s.boxes} box{s.boxes === 1 ? '' : 'es'} · {s.sensitive} sensitive
                    {entry ? (
                      <>
                        {' '}
                        · in the library as <strong>{entry.document_name}</strong>
                        {packet ? ` (${packet.name})` : ''}
                      </>
                    ) : (
                      ' · not published'
                    )}
                  </div>
                </div>
                <span style={{ ...chip, background: r.status === 'published' ? 'var(--bg-green-tint, #e8f3ea)' : 'var(--bg-subtle)', color: r.status === 'published' ? 'var(--text-green-700, #1f7a3a)' : 'var(--text-muted)' }}>{r.status}</span>
                <button type="button" onClick={() => void openRow(r)} disabled={!!busy} style={{ ...btn, fontWeight: 700 }}>
                  Open
                </button>
                <button type="button" onClick={() => void remove(r)} disabled={!!busy} style={{ ...btn, color: 'var(--text-red-700)' }}>
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const btn: CSSProperties = { padding: '0.35rem 0.7rem', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit' }
const inp: CSSProperties = { boxSizing: 'border-box', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', display: 'block', width: '100%', marginTop: '0.2rem' }
const lbl: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }
const chip: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }
