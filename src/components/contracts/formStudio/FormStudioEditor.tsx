import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ContractBookTemplate } from '../ContractBookModal'
import { PdfPageCanvas } from './PdfPageCanvas'
import { FormBoxLayer } from './FormBoxLayer'
import { FormBoxInspector } from './FormBoxInspector'
import {
  buildFillPlan,
  sampleValues,
  validateFormSchema,
  type FormBoxType,
  type FormRect,
  type FormSchema,
} from '../../../lib/forms/formSchema'
import { fillFormPdf, readPdfFields, type FormPdfLibLike } from '../../../lib/forms/fillFormPdf'
import {
  addBox,
  duplicateBox,
  mergeDraftedFields,
  moveOrder,
  moveRect,
  parseSchemaJson,
  promoteToDigits,
  removeBox,
  renameBoxKey,
  schemaSummary,
  setRect,
  updateBox,
} from '../../../lib/forms/formStudioState'
import { publishFormTemplate, replaceFormTemplatePdf, saveFormTemplate, type BookEntryLite, type FormTemplateRow } from '../../../lib/forms/formTemplateRepo'

/**
 * The Form Studio editor (Contract Forms PR 2): the rendered page with the
 * boxes over it, an inspector for the selected box, and a toolbar for adding,
 * importing, previewing, saving, and publishing. Every schema change goes
 * through `formStudioState.ts`, so this file is wiring and layout.
 */

const ZOOMS = [0.9, 1.1, 1.3, 1.6, 2]
const DOC_TYPES = ['agreement', 'coi', 'w9', 'license', 'other'] as const

export function FormStudioEditor({
  row,
  pdf,
  packets,
  bookEntries,
  onBack,
  onSaved,
  onPdfReplaced,
}: {
  row: FormTemplateRow
  pdf: ArrayBuffer
  packets: ContractBookTemplate[]
  bookEntries: BookEntryLite[]
  onBack: () => void
  onSaved: (row: FormTemplateRow) => void
  onPdfReplaced: (row: FormTemplateRow, pdf: ArrayBuffer) => void
}) {
  const [schema, setSchema] = useState<FormSchema>(row.schema)
  const [name, setName] = useState(row.name)
  const [revision, setRevision] = useState(row.revision_label)
  const [docType, setDocType] = useState(row.doc_type)
  const [dirty, setDirty] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [pageNo, setPageNo] = useState(1)
  const [zoomIdx, setZoomIdx] = useState(2)
  const [showSamples, setShowSamples] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBoxes, setPreviewBoxes] = useState(true)
  const [jsonOpen, setJsonOpen] = useState<'import' | 'export' | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishPacket, setPublishPacket] = useState(packets[0]?.id ?? '')
  const [publishDocName, setPublishDocName] = useState(row.name)
  const [publishAudience, setPublishAudience] = useState('sub')
  const [publishVersionDate, setPublishVersionDate] = useState('')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeMask, setMergeMask] = useState('###-##-####')
  const [mergeKey, setMergeKey] = useState('ssn')
  const [mergeLabel, setMergeLabel] = useState('Social Security number')
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const scale = ZOOMS[zoomIdx] ?? 1.3
  const page = schema.pages[pageNo - 1] ?? { width: 612, height: 792 }
  const values = useMemo(() => sampleValues(schema), [schema])
  const problems = useMemo(() => validateFormSchema(schema), [schema])
  const summary = useMemo(() => schemaSummary(schema), [schema])
  const primaryKey = selectedKeys[selectedKeys.length - 1] ?? null
  const primary = primaryKey ? schema.boxes.find((b) => b.key === primaryKey) ?? null : null
  const myEntry = bookEntries.find((d) => d.form_template_id === row.id) ?? null

  useEffect(() => {
    if (myEntry) {
      setPublishPacket(myEntry.template_id)
      setPublishDocName(myEntry.document_name)
    }
  }, [myEntry])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const change = useCallback((next: FormSchema) => {
    setSchema(next)
    setDirty(true)
  }, [])

  // Keyboard: nudge / delete when focus is on the stage (not an input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (selectedKeys.length === 0) return
      const step = e.shiftKey ? 5 : 0.5
      const nudge = (dx: number, dy: number) => {
        e.preventDefault()
        change(selectedKeys.reduce((s, k) => moveRect(s, k, dx, dy), schema))
      }
      if (e.key === 'ArrowLeft') nudge(-step, 0)
      else if (e.key === 'ArrowRight') nudge(step, 0)
      else if (e.key === 'ArrowUp') nudge(0, step)
      else if (e.key === 'ArrowDown') nudge(0, -step)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        change(selectedKeys.reduce((s, k) => removeBox(s, k), schema))
        setSelectedKeys([])
      } else if (e.key === 'Escape') setSelectedKeys([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKeys, schema, change])

  function select(key: string, additive: boolean) {
    setSelectedKeys((prev) => (additive ? (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]) : [key]))
  }

  function add(type: FormBoxType) {
    const r = addBox(schema, type, pageNo)
    change(r.schema)
    setSelectedKeys([r.box.key])
  }

  async function importPdfFields() {
    setBusy('Reading the PDF…')
    setError(null)
    try {
      const lib = (await import('pdf-lib')) as unknown as FormPdfLibLike
      const info = await readPdfFields(lib, pdf)
      const r = mergeDraftedFields(schema, info.fields, info.pages)
      change(r.schema)
      setNotice(`${r.added} field${r.added === 1 ? '' : 's'} imported as boxes${r.skipped ? `, ${r.skipped} already placed` : ''}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function preview() {
    setBusy('Filling the PDF…')
    setError(null)
    try {
      const lib = (await import('pdf-lib')) as unknown as FormPdfLibLike
      const fontkit = (await import('@pdf-lib/fontkit')).default
      let cursive: Uint8Array | null = null
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}fonts/GreatVibes-Regular.ttf`)
        if (res.ok) cursive = new Uint8Array(await res.arrayBuffer())
      } catch {
        cursive = null
      }
      const todayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
      const plan = buildFillPlan(schema, values, { todayLabel, signature: { mode: 'type', text: 'Sample Signer' } })
      const out = await fillFormPdf(lib, pdf, plan, { cursiveFontBytes: cursive, fontkit, debugBoxes: previewBoxes })
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' })))
      if (out.skipped.length > 0) setNotice(`Preview skipped ${out.skipped.length} bind(s) the PDF does not have: ${out.skipped.slice(0, 4).join(', ')}${out.skipped.length > 4 ? '…' : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function save(): Promise<FormTemplateRow | null> {
    setBusy('Saving…')
    setError(null)
    try {
      const saved = await saveFormTemplate(row.id, { name: name.trim() || row.name, revision_label: revision.trim(), doc_type: docType, schema })
      setDirty(false)
      onSaved(saved)
      setNotice('Saved.')
      return saved
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setBusy(null)
    }
  }

  async function publish() {
    if (problems.length > 0 || !publishPacket || !publishDocName.trim()) return
    const saved = dirty ? await save() : row
    if (!saved) return
    setBusy('Publishing…')
    try {
      const r = await publishFormTemplate({ row: { ...saved, name: name.trim() || saved.name }, packetTemplateId: publishPacket, documentName: publishDocName, audience: publishAudience, versionDate: publishVersionDate.trim() || null, existingEntries: bookEntries })
      onSaved(r.template)
      setPublishOpen(false)
      setNotice(`Published. "${publishDocName.trim()}" is now a Contract Book entry in ${packets.find((p) => p.id === publishPacket)?.name ?? 'the packet'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function replacePdf(file: File) {
    setBusy('Replacing the PDF…')
    setError(null)
    try {
      const bytes = await file.arrayBuffer()
      const lib = (await import('pdf-lib')) as unknown as FormPdfLibLike
      const info = await readPdfFields(lib, bytes)
      const next = await replaceFormTemplatePdf(row, bytes, info.pages.length)
      change({ ...schema, pages: info.pages })
      onPdfReplaced(next, bytes)
      setNotice(`PDF replaced (${info.pages.length} page${info.pages.length === 1 ? '' : 's'}, ${info.fields.length} fields). Boxes kept; re-import fields to pick up new ones.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  function applyImportJson() {
    const parsed = parseSchemaJson(jsonText)
    if (!parsed.ok) {
      setError(parsed.errors.map((e) => (e.key ? `${e.key}: ${e.message}` : e.message)).join(' · '))
      return
    }
    change({ ...parsed.schema, pages: parsed.schema.pages.length > 0 ? parsed.schema.pages : schema.pages })
    setJsonOpen(null)
    setSelectedKeys([])
    setNotice(`Imported ${parsed.schema.boxes.length} boxes.`)
  }

  function doMerge() {
    const r = promoteToDigits(schema, selectedKeys, mergeMask, mergeKey.trim(), mergeLabel.trim() || 'Number')
    if (r.error) {
      setError(r.error)
      return
    }
    change(r.schema)
    setSelectedKeys([mergeKey.trim()])
    setMergeOpen(false)
  }

  const canMerge = selectedKeys.length >= 2 && selectedKeys.every((k) => schema.boxes.find((b) => b.key === k)?.type === 'text')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={btn}>
          ‹ Forms
        </button>
        <input value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} aria-label="Form name" style={{ ...inp, width: 220, fontWeight: 700 }} />
        <input value={revision} onChange={(e) => (setRevision(e.target.value), setDirty(true))} aria-label="Revision label" placeholder="Revision, e.g. Rev. March 2024" style={{ ...inp, width: 190 }} />
        <select value={docType} onChange={(e) => (setDocType(e.target.value), setDirty(true))} aria-label="Document type" style={{ ...inp, width: 130 }}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'w9' ? 'W-9' : t === 'coi' ? 'COI' : t}
            </option>
          ))}
        </select>
        <span style={{ ...chip, background: row.status === 'published' ? 'var(--bg-green-tint, #e8f3ea)' : 'var(--bg-subtle)', color: row.status === 'published' ? 'var(--text-green-700, #1f7a3a)' : 'var(--text-muted)' }}>{row.status}</span>
        {dirty ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>unsaved changes</span> : null}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <button type="button" onClick={() => void save()} disabled={!!busy} style={{ ...btn, fontWeight: 700 }}>
            Save
          </button>
          <button type="button" onClick={() => setPublishOpen(true)} disabled={!!busy || problems.length > 0} title={problems.length > 0 ? 'Fix the problems first' : undefined} style={{ ...btn, background: 'var(--text-blue-700, #1d4ed8)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>
            {row.status === 'published' ? 'Republish…' : 'Publish…'}
          </button>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Add</span>
        {(['text', 'digits', 'checkbox', 'signature', 'date', 'constant'] as FormBoxType[]).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} style={btn}>
            + {t}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 0.25rem' }} />
        <button type="button" onClick={() => void importPdfFields()} disabled={!!busy} style={btn} title="Turn the PDF's own fillable fields into boxes (already-placed ones are skipped)">
          Import PDF fields
        </button>
        <button type="button" onClick={() => setMergeOpen(true)} disabled={!canMerge} style={btn} title="Merge the selected text boxes into one masked digits box">
          Merge → digits
        </button>
        <button type="button" onClick={() => (setJsonText(''), setJsonOpen('import'))} style={btn}>
          Import JSON
        </button>
        <button type="button" onClick={() => (setJsonText(JSON.stringify(schema, null, 2)), setJsonOpen('export'))} style={btn}>
          Export JSON
        </button>
        <button type="button" onClick={() => replaceInputRef.current?.click()} disabled={!!busy} style={btn}>
          Replace PDF…
        </button>
        <input ref={replaceInputRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && void replacePdf(e.target.files[0])} />
        <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 0.25rem' }} />
        <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <input type="checkbox" checked={showSamples} onChange={(e) => setShowSamples(e.target.checked)} /> samples
        </label>
        <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <input type="checkbox" checked={previewBoxes} onChange={(e) => setPreviewBoxes(e.target.checked)} /> outline boxes in preview
        </label>
        <button type="button" onClick={() => void preview()} disabled={!!busy} style={{ ...btn, fontWeight: 700 }}>
          Preview filled PDF
        </button>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" onClick={() => setPageNo((p) => Math.max(1, p - 1))} disabled={pageNo <= 1} style={btn}>
            ‹
          </button>
          <span>
            page {pageNo} / {Math.max(1, schema.pages.length)}
          </span>
          <button type="button" onClick={() => setPageNo((p) => Math.min(schema.pages.length || 1, p + 1))} disabled={pageNo >= schema.pages.length} style={btn}>
            ›
          </button>
          <button type="button" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} style={btn}>
            −
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} style={btn}>
            +
          </button>
        </span>
      </div>

      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
      {notice ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {notice}{' '}
          <button type="button" onClick={() => setNotice(null)} style={{ ...btn, padding: '0 0.4rem', fontSize: '0.6875rem' }}>
            ok
          </button>
        </p>
      ) : null}
      {busy ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{busy}</p> : null}
      {problems.length > 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-red-700)', background: 'var(--bg-red-tint, #fbe9e7)', borderRadius: 4, padding: '0.35rem 0.6rem' }}>
          {problems.slice(0, 6).map((p, i) => (
            <div key={i}>
              {p.key ? <code style={{ fontSize: '0.7rem' }}>{p.key}</code> : null} {p.message}
            </div>
          ))}
          {problems.length > 6 ? <div>…and {problems.length - 6} more</div> : null}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '0.75rem', alignItems: 'start' }}>
        <div ref={stageRef} style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.75rem' }}>
          <div style={{ position: 'relative', width: page.width * scale, height: page.height * scale, margin: '0 auto', boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
            <PdfPageCanvas bytes={pdf} page={pageNo} scale={scale} />
            <FormBoxLayer
              schema={schema}
              pageNo={pageNo}
              scale={scale}
              selectedKeys={selectedKeys}
              showSamples={showSamples}
              values={values}
              onSelect={select}
              onChangeRect={(key, rect: FormRect) => change(setRect(schema, key, rect))}
              onBackgroundClick={() => setSelectedKeys([])}
            />
          </div>
        </div>
        <aside style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.7rem 0.8rem', background: 'var(--surface)', maxHeight: '70vh', overflow: 'auto' }}>
          {primary ? (
            <FormBoxInspector
              schema={schema}
              box={primary}
              onPatch={(patch) => change(updateBox(schema, primary.key, patch))}
              onRename={(to) => {
                const r = renameBoxKey(schema, primary.key, to)
                if (r.error) return r.error
                change(r.schema)
                setSelectedKeys([to])
                return null
              }}
              onSchema={change}
              onDelete={() => {
                change(removeBox(schema, primary.key))
                setSelectedKeys([])
              }}
              onDuplicate={() => {
                const r = duplicateBox(schema, primary.key)
                change(r.schema)
                if (r.box) setSelectedKeys([r.box.key])
              }}
              onMoveOrder={(dir) => change(moveOrder(schema, primary.key, dir))}
            />
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                {summary.boxes} box{summary.boxes === 1 ? '' : 'es'} · {summary.asked} asked · {summary.sensitive} sensitive · {summary.bound} fill the PDF&rsquo;s fields · {summary.drawn} drawn
              </p>
              <p style={{ margin: '0 0 0.5rem' }}>Click a box to inspect it. Drag to move, drag a corner to resize. Shift-click selects several; with two or more text boxes selected, Merge → digits turns them into one masked number (SSN, EIN).</p>
              <p style={{ margin: 0 }}>Import PDF fields places every fillable field the PDF already has. Boxes with a solid border fill those fields by name; dashed boxes are drawn at their position.</p>
              {selectedKeys.length > 1 ? <p style={{ margin: '0.5rem 0 0' }}>{selectedKeys.length} selected.</p> : null}
            </div>
          )}
        </aside>
      </div>

      {previewUrl ? (
        <Modal title="Preview — filled with sample values" onClose={() => setPreviewUrl(null)} wide>
          <iframe title="Filled PDF preview" src={previewUrl} style={{ width: '100%', height: '75vh', border: '1px solid var(--border)', borderRadius: 6 }} />
        </Modal>
      ) : null}

      {jsonOpen ? (
        <Modal title={jsonOpen === 'import' ? 'Import schema JSON' : 'Schema JSON'} onClose={() => setJsonOpen(null)}>
          <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} readOnly={jsonOpen === 'export'} spellCheck={false} style={{ ...inp, width: '100%', minHeight: 320, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', justifyContent: 'flex-end' }}>
            {jsonOpen === 'export' ? (
              <button type="button" style={btn} onClick={() => void navigator.clipboard?.writeText(jsonText)}>
                Copy
              </button>
            ) : (
              <button type="button" style={{ ...btn, fontWeight: 700 }} onClick={applyImportJson}>
                Replace boxes with this schema
              </button>
            )}
            <button type="button" style={btn} onClick={() => setJsonOpen(null)}>
              Close
            </button>
          </div>
        </Modal>
      ) : null}

      {mergeOpen ? (
        <Modal title="Merge into one digits box" onClose={() => setMergeOpen(false)}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {selectedKeys.length} boxes selected, left to right → one masked number whose segments fill each PDF field.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem' }}>
              Mask
              <input style={inp} value={mergeMask} onChange={(e) => setMergeMask(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.75rem' }}>
              Key
              <input style={inp} value={mergeKey} onChange={(e) => setMergeKey(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.75rem' }}>
              Label
              <input style={inp} value={mergeLabel} onChange={(e) => setMergeLabel(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setMergeOpen(false)}>
              Cancel
            </button>
            <button type="button" style={{ ...btn, fontWeight: 700 }} onClick={doMerge}>
              Merge
            </button>
          </div>
        </Modal>
      ) : null}

      {publishOpen ? (
        <Modal title={myEntry ? 'Republish this form' : 'Publish as a Contract Book entry'} onClose={() => setPublishOpen(false)}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            The form becomes a document in the Contract library. Assigning its packet, sending, and the portal&rsquo;s Sign now all work the way they do for any document; the signer fills this PDF instead of reading text.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem' }}>
              Packet
              <select style={inp} value={publishPacket} onChange={(e) => setPublishPacket(e.target.value)}>
                {packets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem' }}>
              Document name
              <input style={inp} value={publishDocName} onChange={(e) => setPublishDocName(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.75rem' }}>
              Audience
              <select style={inp} value={publishAudience} onChange={(e) => setPublishAudience(e.target.value)}>
                <option value="sub">sub</option>
                <option value="staff">staff</option>
                <option value="customer">customer</option>
              </select>
            </label>
            <label style={{ fontSize: '0.75rem' }}>
              Version date (optional)
              <input style={inp} type="date" value={publishVersionDate} onChange={(e) => setPublishVersionDate(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setPublishOpen(false)}>
              Cancel
            </button>
            <button type="button" style={{ ...btn, fontWeight: 700 }} disabled={!publishPacket || !publishDocName.trim() || !!busy} onClick={() => void publish()}>
              {myEntry ? 'Republish' : 'Publish'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '1rem 1.1rem', width: wide ? 'min(96vw, 1000px)' : 'min(92vw, 560px)', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <h4 style={{ margin: 0, fontSize: '1rem' }}>{title}</h4>
          <button type="button" onClick={onClose} aria-label="Close" style={btn}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btn: CSSProperties = { padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit' }
const inp: CSSProperties = { boxSizing: 'border-box', padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', display: 'block', width: '100%' }
const chip: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }
