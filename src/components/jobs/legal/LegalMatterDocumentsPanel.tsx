import { useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, companyWeekStartSundayContaining, todayYmdInAppTz } from '../../../utils/dateUtils'
import { PORTAL_COMPANY } from '../../../../supabase/functions/_shared/portalCompany'
import { EmptyState } from '../../EmptyState'
import { LEGAL_DOCUMENT_FILTERS, LEGAL_DOCUMENT_SENT_HOWS, groupLegalDocumentsByWhose, legalDocumentDayWords, legalDocumentFilterCounts, legalDocumentFilterEmptyWords, legalDocumentFilterWords, legalDocumentGroupOf, legalDocumentKindWords, legalDocumentPassesFilter, legalDocumentProblem, legalDocumentSentHowWords, legalDocumentSentProblem, legalDocumentSizeWords, legalDocumentStateChipWords, legalDocumentStateWords, legalDocumentTimelineDay, legalDocumentTitleFromName, legalDocumentWhoseChoices, legalDocumentWhoseGuess, legalDocumentWhoseOf, legalPortalDocumentFromRow, type LegalDocumentDraft, type LegalDocumentFilter, type LegalDocumentSentDraft, type LegalDocumentWhose } from '../../../lib/legal/legalMatterDocuments'
import { addLegalMatterDocument, legalMatterDocumentLink, markLegalMatterDocumentReceived, markLegalMatterDocumentSent, retireLegalMatterDocument, setLegalMatterDocumentState, setLegalMatterDocumentWhose, updateLegalMatterDocument, type LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'

/**
 * Documents for the firm, on the Legal desk's Evidence tab (v2.4810): a drop zone, a title and
 * one line on what each file shows (both required), Hold with a reason, Release, Remove
 * (retire). What the firm sees is the list minus the held ones, under Evidence on its portal.
 * Since v2.5846 (punch list #168) each file carries the day the paper is from (the Timeline places
 * it there) and a state — draft, final, sent or received; *Mark sent…* records the day, how, to whom
 * and the document that proves it (the mailing receipt). A draft is shared with the firm by default
 * (the owner's call of 2026-10-25).
 *
 * Since v2.6108 (punch list #214, PR 3b) the list shows instead of telling: the papers sit under
 * headings by whose paper they are — the payer's, ours, the public record, the supplier's, our
 * record (`legal_matter_documents.whose`, picked when a paper is added, set later from *Whose
 * paper…*, guessed from the title for a row with none and never written back) — the state is a
 * chip, the paper's day a column, the *shows* line one line with the rest on hover, and the send
 * record sits behind the row's ⋯ instead of under its title. Filters stand where the count was.
 */
const shortDay = (ymd: string) => (ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '')
const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 7px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0, width: '100%' }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, lineHeight: '16px', padding: '0 7px', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const filterChip: CSSProperties = { ...btn, height: 22, padding: '0 8px', borderRadius: 999, fontSize: '0.7rem', color: 'var(--text-muted)' }
const filterChipOn: CSSProperties = { background: 'var(--text-700)', color: 'var(--surface)', border: '1px solid var(--text-700)' }
const oneLine: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const OUR_NAME = PORTAL_COMPANY.name

/** The state chip's color: a draft amber, a sent paper blue, a received one green, a final one grey. */
function stateChipColor(state: string): string {
  if (state === 'draft') return 'var(--text-amber-700)'
  if (state === 'sent') return 'var(--text-blue-700)'
  if (state === 'received') return 'var(--text-green-700)'
  return 'var(--text-muted)'
}

type Pending = { key: string; file: File; draft: LegalDocumentDraft; /** The person picked whose paper it is; the title no longer guesses. */ whoseTouched: boolean }

export default function LegalMatterDocumentsPanel({ matterId, documents, canEdit, onChanged, payerName = '' }: { matterId: string; documents: ReadonlyArray<LegalMatterDocumentRow>; canEdit: boolean; onChanged: () => void; /** The payer's name, for the heading of their paper and the guess (v2.6108). */ payerName?: string }) {
  const [pending, setPending] = useState<Pending[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holdFor, setHoldFor] = useState<{ id: string; reason: string } | null>(null)
  const [sentFor, setSentFor] = useState<{ id: string; draft: LegalDocumentSentDraft } | null>(null)
  const [receivedFor, setReceivedFor] = useState<{ id: string; on: string } | null>(null)
  const [whoseFor, setWhoseFor] = useState<{ id: string; whose: LegalDocumentWhose | '' } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [filter, setFilter] = useState<LegalDocumentFilter>('all')
  const todayYmd = todayYmdInAppTz()
  const weekStart = companyWeekStartSundayContaining(todayYmd) ?? ''
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const choices = legalDocumentWhoseChoices(payerName)

  // v2.6108: each row once as the firm reads it (its day, its state), then the filters and the groups.
  const docById = new Map(documents.map((d) => [d.id, legalPortalDocumentFromRow(d, '', '', calendarYmdInAppTzFromIso)] as const))
  const docOf = (d: LegalMatterDocumentRow) => docById.get(d.id)!
  const filterShape = (d: LegalMatterDocumentRow) => ({ state: docOf(d).state, held: Boolean(d.held_reason), addedOn: docOf(d).addedOn })
  const counts = legalDocumentFilterCounts(documents.map(filterShape), weekStart)
  const groups = groupLegalDocumentsByWhose(documents.filter((d) => legalDocumentPassesFilter(filterShape(d), filter, weekStart)), payerName, (d) => legalDocumentTimelineDay(docOf(d)), OUR_NAME)

  const take = (files: FileList | File[]) => {
    const next = [...files].map((file) => {
      const title = legalDocumentTitleFromName(file.name)
      return { key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file, draft: { title, shows: '', datedOn: todayYmd, state: 'final' as const, receivedOn: '', whose: legalDocumentWhoseGuess({ title, state: 'final' }, payerName, OUR_NAME) }, whoseTouched: false }
    })
    setPending((p) => [...p, ...next])
  }
  const patchPending = (key: string, patch: (x: Pending) => Pending) => setPending((list) => list.map((x) => (x.key === key ? patch(x) : x)))
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
    await addLegalMatterDocument(supabase, matterId, p.draft, p.file)
    setPending((list) => list.filter((x) => x.key !== p.key))
  })
  const open = (d: LegalMatterDocumentRow) => void act('Could not open the document.', async () => {
    const url = await legalMatterDocumentLink(supabase, d.storage_path)
    window.open(url, '_blank', 'noopener')
  })

  return (
    <div data-legal-matter-documents style={{ margin: '0 0 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.86rem' }}>Documents for the firm</b>
        {documents.length ? (
          // v2.6108: the filters where the count was; a filter with nothing behind it is dead.
          <span data-legal-document-filters role="group" aria-label="Show which documents" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {LEGAL_DOCUMENT_FILTERS.map((f) => {
              const n = counts[f]
              const on = filter === f
              const dead = f !== 'all' && n === 0
              return (
                <button key={f} type="button" data-legal-document-filter={f} aria-pressed={on} disabled={dead} onClick={() => setFilter(f)} style={{ ...filterChip, ...(on ? filterChipOn : null), opacity: dead ? 0.45 : 1, cursor: dead ? 'default' : 'pointer' }}>
                  {legalDocumentFilterWords(f)} · {n}
                </button>
              )
            })}
          </span>
        ) : null}
        <span style={{ ...MUTED, fontSize: '0.78rem', marginLeft: 'auto' }}>the firm reads them under Evidence on its portal</span>
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
            <input aria-label="Title" value={p.draft.title} onChange={(e) => patchPending(p.key, (x) => ({ ...x, draft: { ...x.draft, title: e.target.value, whose: x.whoseTouched ? x.draft.whose : legalDocumentWhoseGuess({ title: e.target.value, shows: x.draft.shows, state: x.draft.state }, payerName, OUR_NAME) } }))} placeholder="Title" style={input} />
            <input aria-label="What it shows" value={p.draft.shows} onChange={(e) => patchPending(p.key, (x) => ({ ...x, draft: { ...x.draft, shows: e.target.value } }))} placeholder="What it shows, in one line" style={input} />
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <button type="button" disabled={busy || !!problem} title={problem ?? undefined} onClick={() => save(p)} style={{ ...btnPrimary, opacity: busy || problem ? 0.6 : 1 }}>Save</button>
              <button type="button" onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))} style={btn}>Drop</button>
            </span>
            <span style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.74rem' }}>
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>Dated<input type="date" aria-label="Day the paper is from" value={p.draft.datedOn ?? ''} max={todayYmd} onChange={(e) => patchPending(p.key, (x) => ({ ...x, draft: { ...x.draft, datedOn: e.target.value } }))} style={{ ...input, width: 'auto' }} /></label>
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>State<select aria-label="State of the paper" value={p.draft.state ?? 'final'} onChange={(e) => patchPending(p.key, (x) => ({ ...x, draft: { ...x.draft, state: e.target.value as LegalDocumentDraft['state'] } }))} style={{ ...input, width: 'auto' }}><option value="final">Final</option><option value="draft">Draft</option><option value="received">Received</option></select></label>
              {p.draft.state === 'received' ? <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>Received on<input type="date" aria-label="Day it was received" value={p.draft.receivedOn ?? ''} max={todayYmd} onChange={(e) => patchPending(p.key, (x) => ({ ...x, draft: { ...x.draft, receivedOn: e.target.value } }))} style={{ ...input, width: 'auto' }} /></label> : null}
              {/* v2.6108: whose paper it is, guessed from the title until the person picks. */}
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>Whose<select aria-label="Whose paper it is" data-legal-document-whose-pick data-guessed={p.whoseTouched ? 'no' : 'yes'} value={p.draft.whose ?? ''} onChange={(e) => patchPending(p.key, (x) => ({ ...x, whoseTouched: true, draft: { ...x.draft, whose: (e.target.value || null) as LegalDocumentWhose | null } }))} style={{ ...input, width: 'auto' }}>{choices.map((c) => <option key={c.value} value={c.value}>{c.words}</option>)}</select></label>
            </span>
            <span style={{ gridColumn: '1 / -1', ...MUTED, fontSize: '0.74rem' }}>{p.file.name} · {legalDocumentSizeWords(p.file.size)}{problem ? ` · ${problem}` : ''}</span>
          </div>
        )
      })}
      {error ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{error}</div> : null}
      {documents.length === 0 && pending.length === 0 ? <div style={{ ...MUTED, fontSize: '0.8rem' }}>Nothing yet. A billing report, a supplier invoice, a signed estimate, an email thread printed to PDF: each with one line on what it shows.</div> : null}
      {documents.length > 0 && groups.length === 0 ? <EmptyState compact main={legalDocumentFilterEmptyWords(filter)} next={{ label: 'Show every paper', onPress: () => setFilter('all') }} /> : null}
      {groups.map((g) => {
        const guessed = g.rows.filter((d) => legalDocumentGroupOf(d, payerName, OUR_NAME).guessed).length
        return (
          <div key={g.key} data-legal-document-group={g.key} style={{ display: 'grid' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', padding: '6px 0 2px', fontSize: '0.8rem' }}>
              <b>{g.words}</b>
              <span style={MUTED}>· {g.rows.length}</span>
              {guessed ? <span data-legal-document-group-guessed title="Rows with no whose on record sit here by their title. Whose paper… on a row’s ⋯ sets it." style={{ ...MUTED, fontSize: '0.72rem' }}>· {guessed} by title</span> : null}
            </div>
            {g.rows.map((d) => {
              const doc = docOf(d)
              const stateWords = legalDocumentStateWords(doc, shortDay)
              const chipWords = legalDocumentStateChipWords(doc)
              const proof = doc.proofDocumentId ? documents.find((x) => x.id === doc.proofDocumentId) : undefined
              const others = documents.filter((x) => x.id !== d.id)
              const group = legalDocumentGroupOf(d, payerName, OUR_NAME)
              const day = legalDocumentTimelineDay(doc)
              return (
                <div key={d.id} data-legal-document={d.id} data-held={d.held_reason ? 'yes' : 'no'} data-legal-document-state={doc.state} data-legal-document-whose={group.key} data-legal-document-guessed={group.guessed ? 'yes' : 'no'} style={{ display: 'grid', gridTemplateColumns: 'auto 3.4rem minmax(0, 1fr) auto', gap: 8, alignItems: 'center', padding: '4px 0', borderTop: '1px dotted var(--border)', fontSize: '0.8rem' }}>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <span data-legal-document-state-chip {...(doc.state === 'draft' ? { 'data-legal-document-draft': '' } : null)} title={stateWords || 'The paper as it stands.'} style={{ ...chip, color: stateChipColor(doc.state) }}>{chipWords}</span>
                    {d.held_reason ? <span data-legal-document-held-chip title={`Held from the firm: ${d.held_reason}`} style={{ ...chip, color: 'var(--text-amber-700)' }}>held</span> : null}
                  </span>
                  <span data-legal-document-day title={legalDocumentDayWords(doc, shortDay)} style={{ ...MUTED, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{shortDay(day)}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                    <button type="button" onClick={() => open(d)} title={`${d.title} · ${legalDocumentKindWords(d.mime)} · ${legalDocumentSizeWords(d.size_bytes)}`} style={{ ...btn, ...oneLine, border: 'none', padding: 0, height: 'auto', fontWeight: 600, color: 'var(--text-link)', flex: '0 1 auto', display: 'inline-block' }}>{d.title}</button>
                    <span data-legal-document-shows title={d.shows} style={{ ...MUTED, ...oneLine, flex: '1 1 40%' }}>{d.shows}</span>
                  </span>
                  {canEdit ? (
                    // v2.5850: one menu per row instead of four buttons; the hold form opens in place, as before.
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
                      {holdFor?.id === d.id ? (
                        <>
                          <input autoFocus aria-label="Why the firm should not see it" value={holdFor.reason} onChange={(e) => setHoldFor({ id: d.id, reason: e.target.value })} placeholder="Why the firm should not see it" style={{ ...input, width: 220 }} />
                          <button type="button" disabled={busy || !holdFor.reason.trim()} onClick={() => void act('Could not hold the document.', async () => { await updateLegalMatterDocument(supabase, d.id, { held_reason: holdFor.reason }); setHoldFor(null) })} style={btnPrimary}>Hold back</button>
                          <button type="button" onClick={() => setHoldFor(null)} style={btn}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={busy} aria-haspopup="menu" aria-expanded={menuFor === d.id} aria-label={`Actions for ${d.title}`} data-legal-document-menu onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} style={{ ...btn, minWidth: 30, justifyContent: 'center' }} title="The record, whose paper it is, hold, mark sent or received, remove">⋯</button>
                          {menuFor === d.id ? (
                            <div role="menu" data-legal-document-menu-open onKeyDown={(e) => { if (e.key === 'Escape') setMenuFor(null) }} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 5, marginTop: 4, minWidth: 240, maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 4, display: 'grid' }}>
                              {/* v2.6108: the row's record lives here, once, instead of under every title. */}
                              <div data-legal-document-record style={{ padding: '4px 8px 6px', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: 4, whiteSpace: 'normal', textAlign: 'left' }}>
                                <div>{legalDocumentKindWords(d.mime)} · {legalDocumentSizeWords(d.size_bytes)} · {legalDocumentDayWords(doc, shortDay)}</div>
                                {stateWords && doc.state !== 'draft' ? <div data-legal-document-state-words>{stateWords}{proof ? <> · proof: <button type="button" onClick={() => { setMenuFor(null); open(proof) }} style={{ ...btn, border: 'none', padding: 0, height: 'auto', fontSize: '0.72rem', color: 'var(--text-link)' }}>{proof.title}</button></> : null}</div> : null}
                                {d.held_reason ? <div style={{ color: 'var(--text-amber-700)' }}>Held from the firm: {d.held_reason}</div> : null}
                                {group.guessed ? <div>Under {g.words} by its title. Whose paper… sets it.</div> : null}
                              </div>
                              {([
                                d.held_reason ? { label: 'Release to the firm', go: () => void act('Could not release the document.', () => updateLegalMatterDocument(supabase, d.id, { held_reason: '' })) } : { label: 'Hold from the firm…', go: () => setHoldFor({ id: d.id, reason: '' }) },
                                { label: 'Whose paper…', go: () => { setSentFor(null); setReceivedFor(null); setWhoseFor({ id: d.id, whose: legalDocumentWhoseOf(d.whose) ?? '' }) } },
                                doc.state === 'draft' || doc.state === 'final' ? { label: 'Mark sent…', go: () => { setReceivedFor(null); setWhoseFor(null); setSentFor({ id: d.id, draft: { sentOn: todayYmd, sentHow: '', sentTo: '', proofDocumentId: '' } }) } } : null,
                                doc.state === 'draft' ? { label: 'Mark final', go: () => void act('Could not mark the document final.', () => setLegalMatterDocumentState(supabase, d.id, 'final')) } : null,
                                doc.state === 'final' ? { label: 'Received…', go: () => { setSentFor(null); setWhoseFor(null); setReceivedFor({ id: d.id, on: todayYmd }) } } : null,
                                doc.state === 'sent' ? { label: 'Not sent after all', go: () => void act('Could not change the document.', () => setLegalMatterDocumentState(supabase, d.id, 'final')) } : null,
                                doc.state === 'received' ? { label: 'Not received after all', go: () => void act('Could not change the document.', () => setLegalMatterDocumentState(supabase, d.id, 'final')) } : null,
                                { label: 'Remove', go: () => void act('Could not remove the document.', () => retireLegalMatterDocument(supabase, d.id)) },
                              ] as Array<{ label: string; go: () => void } | null>).filter((m): m is { label: string; go: () => void } => Boolean(m)).map((m) => (
                                <button key={m.label} type="button" role="menuitem" onClick={() => { setMenuFor(null); m.go() }} style={{ ...btn, border: 'none', justifyContent: 'flex-start', height: 28, borderRadius: 6, ...(m.label === 'Remove' ? { color: 'var(--text-red-700)' } : null) }}>{m.label}</button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </span>
                  ) : <span />}
                  {d.held_reason ? <div data-legal-document-held-words style={{ gridColumn: '1 / -1', color: 'var(--text-amber-700)', fontSize: '0.72rem', marginTop: -2 }}>Held from the firm: {d.held_reason}</div> : null}
                  {canEdit && whoseFor?.id === d.id ? (
                    // v2.6108: *Whose paper…* — the pick, saved to the row; the guess stops once it is set.
                    <form data-legal-document-whose-form onSubmit={(e) => { e.preventDefault(); void act('Could not change whose paper it is.', async () => { await setLegalMatterDocumentWhose(supabase, d.id, whoseFor.whose || null); setWhoseFor(null) }) }} style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 4px' }}>
                      <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED, fontSize: '0.74rem' }}>Whose paper<select autoFocus aria-label="Whose paper" value={whoseFor.whose} onChange={(e) => setWhoseFor({ id: d.id, whose: e.target.value as LegalDocumentWhose | '' })} style={{ ...input, width: 'auto' }}>{choices.map((c) => <option key={c.value} value={c.value}>{c.words}</option>)}</select></label>
                      <button type="submit" disabled={busy} style={btnPrimary}>Save</button>
                      <button type="button" onClick={() => setWhoseFor(null)} style={btn}>Cancel</button>
                      {group.guessed ? <span style={{ ...MUTED, fontSize: '0.74rem' }}>Guessed from the title until you save it.</span> : null}
                    </form>
                  ) : null}
                  {canEdit && sentFor?.id === d.id ? (
                    <form data-legal-document-sent-form onSubmit={(e) => { e.preventDefault(); if (!legalDocumentSentProblem(sentFor.draft, todayYmd)) void act('Could not mark the document sent.', async () => { await markLegalMatterDocumentSent(supabase, d.id, sentFor.draft); setSentFor(null) }) }} style={{ gridColumn: '1 / -1', display: 'grid', gap: 6, margin: '2px 0 4px', padding: '8px', border: '1px dashed var(--border-strong)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED, fontSize: '0.74rem' }}>Went out<input type="date" aria-label="Day it went out" value={sentFor.draft.sentOn} max={todayYmd} onChange={(e) => setSentFor({ id: d.id, draft: { ...sentFor.draft, sentOn: e.target.value } })} style={{ ...input, width: 'auto' }} /></label>
                        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED, fontSize: '0.74rem' }}>How<select aria-label="How it went out" value={sentFor.draft.sentHow} onChange={(e) => setSentFor({ id: d.id, draft: { ...sentFor.draft, sentHow: e.target.value as LegalDocumentSentDraft['sentHow'] } })} style={{ ...input, width: 'auto' }}><option value="">Pick one</option>{LEGAL_DOCUMENT_SENT_HOWS.map((h) => <option key={h} value={h}>{legalDocumentSentHowWords(h).replace(/^by /, '') || 'another way'}</option>)}</select></label>
                      </div>
                      <input aria-label="Who it went to" value={sentFor.draft.sentTo} placeholder="Who it went to" onChange={(e) => setSentFor({ id: d.id, draft: { ...sentFor.draft, sentTo: e.target.value } })} style={input} />
                      {others.length ? <label style={{ display: 'grid', gap: 3, ...MUTED, fontSize: '0.74rem' }}>The proof it went out, such as the mailing receipt<select aria-label="Document that proves the send" value={sentFor.draft.proofDocumentId} onChange={(e) => setSentFor({ id: d.id, draft: { ...sentFor.draft, proofDocumentId: e.target.value } })} style={input}><option value="">None yet</option>{others.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label> : null}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="submit" disabled={busy || Boolean(legalDocumentSentProblem(sentFor.draft, todayYmd))} style={{ ...btnPrimary, opacity: busy || legalDocumentSentProblem(sentFor.draft, todayYmd) ? 0.6 : 1 }}>Mark sent</button>
                        <button type="button" onClick={() => setSentFor(null)} style={btn}>Cancel</button>
                        {legalDocumentSentProblem(sentFor.draft, todayYmd) ? <span style={{ ...MUTED, fontSize: '0.74rem' }}>{legalDocumentSentProblem(sentFor.draft, todayYmd)}</span> : null}
                      </div>
                    </form>
                  ) : null}
                  {canEdit && receivedFor?.id === d.id ? (
                    <form data-legal-document-received-form onSubmit={(e) => { e.preventDefault(); if (receivedFor.on && receivedFor.on <= todayYmd) void act('Could not mark the document received.', async () => { await markLegalMatterDocumentReceived(supabase, d.id, receivedFor.on); setReceivedFor(null) }) }} style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 4px' }}>
                      <input type="date" aria-label="Day it was received" value={receivedFor.on} max={todayYmd} onChange={(e) => setReceivedFor({ id: d.id, on: e.target.value })} style={{ ...input, width: 'auto' }} />
                      <button type="submit" disabled={busy || !receivedFor.on || receivedFor.on > todayYmd} style={btnPrimary}>Mark received</button>
                      <button type="button" onClick={() => setReceivedFor(null)} style={btn}>Cancel</button>
                    </form>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
