import { useRef, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { legalDocumentKindWords, legalDocumentProblem, legalDocumentSizeWords, legalDocumentTitleFromName, type LegalDocumentDraft } from '../../../lib/legal/legalMatterDocuments'
import { addLegalMatterDocument, legalMatterDocumentLink, retireLegalMatterDocument, updateLegalMatterDocument, type LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'

/**
 * Documents for the firm, on the Legal desk's Evidence tab (v2.4810): a drop zone, a title and
 * one line on what each file shows (both required), Hold with a reason, Release, Remove
 * (retire). What the firm sees is the list minus the held ones, under Evidence on its portal.
 */
const db = supabase as unknown as SupabaseClient
const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 7px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0, width: '100%' }

type Pending = { key: string; file: File; draft: LegalDocumentDraft }

export default function LegalMatterDocumentsPanel({ matterId, documents, canEdit, onChanged }: { matterId: string; documents: ReadonlyArray<LegalMatterDocumentRow>; canEdit: boolean; onChanged: () => void }) {
  const [pending, setPending] = useState<Pending[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holdFor, setHoldFor] = useState<{ id: string; reason: string } | null>(null)
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const shown = documents.filter((d) => !d.held_reason)
  const held = documents.filter((d) => d.held_reason)

  const take = (files: FileList | File[]) => {
    const next = [...files].map((file) => ({ key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file, draft: { title: legalDocumentTitleFromName(file.name), shows: '' } }))
    setPending((p) => [...p, ...next])
  }
  const act = async (fallback: string, fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      setError(null)
      onChanged()
    } catch (e) {
      setError(formatErrorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }
  const save = (p: Pending) => void act(`Could not save ${p.file.name}.`, async () => {
    await addLegalMatterDocument(db, matterId, p.draft, p.file)
    setPending((list) => list.filter((x) => x.key !== p.key))
  })
  const open = (d: LegalMatterDocumentRow) => void act('Could not open the document.', async () => {
    const url = await legalMatterDocumentLink(db, d.storage_path)
    window.open(url, '_blank', 'noopener')
  })

  return (
    <div data-legal-matter-documents style={{ margin: '0 0 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.86rem' }}>Documents for the firm</b>
        <span style={{ ...MUTED, fontSize: '0.78rem' }}>{shown.length} shown{held.length ? ` · ${held.length} held` : ''} · the firm reads them under Evidence on its portal</span>
      </div>
      {canEdit ? (
        <div
          data-legal-documents-drop
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) take(e.dataTransfer.files) }}
          style={{ border: `2px dashed ${over ? 'var(--text-700)' : 'var(--border-strong)'}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}
        >
          Drop PDFs, images or .eml files here, or{' '}
          <button type="button" onClick={() => fileRef.current?.click()} style={btn}>Choose files</button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.eml,.txt,application/pdf,image/*,message/rfc822,text/plain" aria-label="Choose documents" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) take(e.target.files); e.target.value = '' }} />
          {' '}· each needs a title and one line on what it shows before it saves
        </div>
      ) : null}
      {pending.map((p) => {
        const problem = legalDocumentProblem(p.draft, p.file)
        return (
          <div key={p.key} data-legal-document-pending style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr) auto', gap: 6, alignItems: 'center', padding: '6px 8px', border: '1px dashed var(--border-strong)', borderRadius: 6 }}>
            <input aria-label="Title" value={p.draft.title} onChange={(e) => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, draft: { ...x.draft, title: e.target.value } } : x)))} placeholder="Title" style={input} />
            <input aria-label="What it shows" value={p.draft.shows} onChange={(e) => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, draft: { ...x.draft, shows: e.target.value } } : x)))} placeholder="What it shows, in one line" style={input} />
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <button type="button" disabled={busy || !!problem} title={problem ?? undefined} onClick={() => save(p)} style={{ ...btnPrimary, opacity: busy || problem ? 0.6 : 1 }}>Save</button>
              <button type="button" onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))} style={btn}>Drop</button>
            </span>
            <span style={{ gridColumn: '1 / -1', ...MUTED, fontSize: '0.74rem' }}>{p.file.name} · {legalDocumentSizeWords(p.file.size)}{problem ? ` · ${problem}` : ''}</span>
          </div>
        )
      })}
      {error ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{error}</div> : null}
      {documents.length === 0 && pending.length === 0 ? <div style={{ ...MUTED, fontSize: '0.8rem' }}>Nothing yet. A billing report, a supplier invoice, a signed estimate, an email thread printed to PDF: each with one line on what it shows.</div> : null}
      {documents.map((d) => (
        <div key={d.id} data-legal-document={d.id} data-held={d.held_reason ? 'yes' : 'no'} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr) auto', gap: 6, alignItems: 'baseline', padding: '5px 0', borderTop: '1px dotted var(--border)', fontSize: '0.8rem' }}>
          <span>
            <button type="button" onClick={() => open(d)} style={{ ...btn, border: 'none', padding: 0, height: 'auto', fontWeight: 600, color: 'var(--text-link)' }}>{d.title}</button>
            <div style={{ ...MUTED, fontSize: '0.72rem' }}>{legalDocumentKindWords(d.mime)} · {legalDocumentSizeWords(d.size_bytes)} · {calendarYmdInAppTzFromIso(d.added_at)}</div>
          </span>
          <span>
            {d.shows}
            {d.held_reason ? <div style={{ color: 'var(--text-amber-700)', fontSize: '0.74rem' }}>Held from the firm: {d.held_reason}</div> : null}
          </span>
          {canEdit ? (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {holdFor?.id === d.id ? (
                <>
                  <input autoFocus aria-label="Why the firm should not see it" value={holdFor.reason} onChange={(e) => setHoldFor({ id: d.id, reason: e.target.value })} placeholder="Why the firm should not see it" style={{ ...input, width: 220 }} />
                  <button type="button" disabled={busy || !holdFor.reason.trim()} onClick={() => void act('Could not hold the document.', async () => { await updateLegalMatterDocument(db, d.id, { held_reason: holdFor.reason }); setHoldFor(null) })} style={btnPrimary}>Hold back</button>
                  <button type="button" onClick={() => setHoldFor(null)} style={btn}>Cancel</button>
                </>
              ) : d.held_reason ? (
                <button type="button" disabled={busy} onClick={() => void act('Could not release the document.', () => updateLegalMatterDocument(db, d.id, { held_reason: '' }))} style={btn}>Release to the firm</button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setHoldFor({ id: d.id, reason: '' })} style={btn}>Hold</button>
              )}
              <button type="button" disabled={busy} onClick={() => void act('Could not remove the document.', () => retireLegalMatterDocument(db, d.id))} style={btn}>Remove</button>
            </span>
          ) : <span />}
        </div>
      ))}
    </div>
  )
}
