import { useState, type CSSProperties } from 'react'
import ConfirmDialog from '../../ConfirmDialog'
import { personRoleWords, type LegalMatterPersonLike } from '../../../lib/legal/legalMatterPeople'
import {
  LEGAL_PROCEEDING_KINDS,
  LEGAL_PROCEEDING_STATUSES,
  PROCEEDINGS_EMPTY_WORDS,
  emptyProceedingDraft,
  proceedingDetailWords,
  proceedingDraftOf,
  proceedingDraftProblem,
  proceedingKindWords,
  proceedingStatusWords,
  type LegalProceedingDraft,
  type LegalProceedingKind,
  type LegalProceedingLike,
  type LegalProceedingStatus,
} from '../../../lib/legal/legalProceedings'
import { MUTED, TD, TH, btn, btnPrimary, pill, SectionTitle, type Tone } from './legalDeskShared'

/**
 * The proceedings beside the claim (punch list #174, v2.6726), on the Account tab under People on the matter: an
 * agency complaint, a records request, a bond claim, a permit question — each with its agency, its reference, a
 * contact from the matter's people, where it stands and the Evidence documents behind it. *Keep its documents out of
 * settlement letters* holds those documents out of anything addressed to the other side: the Evidence rows wear the
 * chip and the claim table's document picker leaves them out. The office adds, edits and removes; the firm reads the
 * list on its portal, never the note.
 */

/** What the desk hands the list beyond the rows: the people to pick a contact from, the documents to pick from, the office's acts (null when read only). */
export type ProceedingsPanel = {
  people: ReadonlyArray<LegalMatterPersonLike>
  documents: ReadonlyArray<{ id: string; title: string }>
  onOpenDocument?: (documentId: string) => void
  acts: {
    /** Add (proceedingId null) or edit a proceeding; resolves to the refusal's words, or null when it took. */
    save: (draft: LegalProceedingDraft, proceedingId: string | null) => Promise<string | null>
    remove: (proceedingId: string) => Promise<string | null>
  } | null
}

const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.84rem', padding: '4px 6px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }
const LABEL: CSSProperties = { ...MUTED, fontSize: '0.72rem', display: 'grid', gap: 2 }

type Form = { proceedingId: string | null; draft: LegalProceedingDraft }

const statusTone = (status: LegalProceedingStatus): Tone => (status === 'open' ? 'blue' : status === 'answered' ? 'ok' : 'neutral')

export default function LegalProceedingsTable({ proceedings, panel }: { proceedings: ReadonlyArray<LegalProceedingLike>; panel: ProceedingsPanel }) {
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<LegalProceedingLike | null>(null)
  const acts = panel.acts
  const personName = (id: string | null) => (id ? panel.people.find((p) => p.id === id)?.name ?? null : null)
  const documentTitle = (id: string) => panel.documents.find((d) => d.id === id)?.title ?? 'a document no longer on the matter'

  const act = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    try {
      const err = await fn()
      setError(err)
      return err == null
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!form || !acts) return
    const problem = proceedingDraftProblem(form.draft)
    if (problem) {
      setError(problem)
      return
    }
    if (await act(() => acts.save(form.draft, form.proceedingId))) setForm(null)
  }
  const remove = async () => {
    if (!removing || !acts) return
    const id = removing.id
    setRemoving(null)
    if (await act(() => acts.remove(id))) setForm((f) => (f?.proceedingId === id ? null : f))
  }
  const patch = (p: Partial<LegalProceedingDraft>) => setForm((f) => (f ? { ...f, draft: { ...f.draft, ...p } } : f))
  const toggleDocument = (id: string, on: boolean) => setForm((f) => (f ? { ...f, draft: { ...f.draft, documentIds: on ? [...new Set([...f.draft.documentIds, id])] : f.draft.documentIds.filter((x) => x !== id) } } : f))

  return (
    <div data-legal-proceedings>
      <SectionTitle doors={pill('the firm reads this list', 'neutral')}>Beside the claim</SectionTitle>
      {proceedings.length === 0 ? (
        <p data-legal-proceedings-empty style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0 6px' }}>{PROCEEDINGS_EMPTY_WORDS}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Proceeding</th>
                <th style={TH}>Agency</th>
                <th style={TH}>Where it stands</th>
                <th style={TH} aria-label="Edit" />
              </tr>
            </thead>
            <tbody>
              {proceedings.map((p) => {
                const detail = proceedingDetailWords(p, personName(p.personId))
                return (
                  <tr key={p.id} data-legal-proceeding={p.id} data-legal-proceeding-kept-out={p.keepOut && p.documentIds.length ? 'yes' : 'no'}>
                    <td style={TD}>
                      <div style={{ ...MUTED, fontSize: '0.72rem' }}>{proceedingKindWords(p.kind)}</div>
                      <b>{p.title}</b>
                      {detail ? <div data-legal-proceeding-detail style={{ ...MUTED, fontSize: '0.76rem' }}>{detail}</div> : null}
                      {p.documentIds.length ? (
                        <div style={{ display: 'flex', gap: '0 8px', flexWrap: 'wrap', fontSize: '0.76rem' }}>
                          {p.documentIds.map((id) =>
                            panel.onOpenDocument ? (
                              <button key={id} type="button" onClick={() => panel.onOpenDocument?.(id)} style={{ ...btn, border: 'none', padding: 0, height: 'auto', fontSize: '0.76rem', color: 'var(--text-link)' }}>{documentTitle(id)}</button>
                            ) : (
                              <span key={id} style={MUTED}>{documentTitle(id)}</span>
                            ),
                          )}
                        </div>
                      ) : null}
                      {p.note ? <div style={{ ...MUTED, fontSize: '0.76rem', fontStyle: 'italic' }}>{p.note}</div> : null}
                    </td>
                    <td style={TD}>{p.agency || <span style={MUTED}>—</span>}</td>
                    <td style={TD}>{pill(proceedingStatusWords(p.status, p.statusOn), statusTone(p.status))}</td>
                    <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {acts ? <button type="button" onClick={() => { setError(null); setForm({ proceedingId: p.id, draft: proceedingDraftOf(p) }) }} style={{ ...btn, height: 22, fontSize: '0.72rem' }}>Edit</button> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {acts && !form ? (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" data-legal-proceedings-add onClick={() => { setError(null); setForm({ proceedingId: null, draft: emptyProceedingDraft() }) }} style={btn}>＋ Add a proceeding</button>
        </div>
      ) : null}
      {form && acts ? (
        <div data-legal-proceedings-form style={{ marginTop: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: '0.84rem' }}>{form.proceedingId ? 'Edit the proceeding' : 'Add a proceeding'}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Kind
              <select value={form.draft.kind} onChange={(e) => patch({ kind: e.target.value as LegalProceedingKind })} style={INPUT} data-legal-proceeding-kind>
                {LEGAL_PROCEEDING_KINDS.map((k) => <option key={k} value={k}>{proceedingKindWords(k)}</option>)}
              </select>
            </label>
            <label style={{ ...LABEL, gridColumn: 'span 2' }}>
              Name
              <input value={form.draft.title} onChange={(e) => patch({ title: e.target.value })} style={INPUT} data-legal-proceeding-title placeholder="Complaint to the State Plumbing Board" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Agency
              <input value={form.draft.agency} onChange={(e) => patch({ agency: e.target.value })} style={INPUT} data-legal-proceeding-agency placeholder="State Plumbing Board" />
            </label>
            <label style={LABEL}>
              Reference
              <input value={form.draft.reference} onChange={(e) => patch({ reference: e.target.value })} style={INPUT} data-legal-proceeding-reference placeholder="C-2026-0431" />
            </label>
            <label style={LABEL}>
              Contact from the people
              <select value={form.draft.personId ?? ''} onChange={(e) => patch({ personId: e.target.value || null })} style={INPUT} data-legal-proceeding-person>
                <option value="">nobody yet</option>
                {panel.people.map((p) => <option key={p.id} value={p.id}>{p.name} · {personRoleWords(p.role)}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Where it stands
              <select value={form.draft.status} onChange={(e) => patch({ status: e.target.value as LegalProceedingStatus })} style={INPUT} data-legal-proceeding-status>
                {LEGAL_PROCEEDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={LABEL}>
              Since
              <input type="date" value={form.draft.statusOn} onChange={(e) => patch({ statusOn: e.target.value })} style={INPUT} data-legal-proceeding-status-on />
            </label>
            <label style={LABEL}>
              Note
              <input value={form.draft.note} onChange={(e) => patch({ note: e.target.value })} style={INPUT} data-legal-proceeding-note placeholder="the office's own words; the firm never reads them" />
            </label>
          </div>
          <div style={LABEL}>
            Documents from Evidence
            {panel.documents.length === 0 ? (
              <span style={{ ...MUTED, fontSize: '0.78rem' }}>Put the papers on the Evidence tab first, then tick them here.</span>
            ) : (
              <div data-legal-proceeding-documents style={{ display: 'grid', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
                {panel.documents.map((d) => (
                  <label key={d.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text)' }}>
                    <input type="checkbox" checked={form.draft.documentIds.includes(d.id)} onChange={(e) => toggleDocument(d.id, e.target.checked)} data-legal-proceeding-document={d.id} />
                    {d.title}
                  </label>
                ))}
              </div>
            )}
          </div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={form.draft.keepOut} onChange={(e) => patch({ keepOut: e.target.checked })} data-legal-proceeding-keep-out />
            Keep its documents out of settlement letters
          </label>
          {error ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: 0 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void save()} disabled={busy} style={btnPrimary} data-legal-proceeding-save>Save the proceeding</button>
            <button type="button" onClick={() => { setForm(null); setError(null) }} disabled={busy} style={btn}>Cancel</button>
            {form.proceedingId ? <button type="button" onClick={() => setRemoving(proceedings.find((p) => p.id === form.proceedingId) ?? null)} disabled={busy} style={{ ...btn, marginLeft: 'auto', color: '#b42318' }} data-legal-proceeding-remove>Remove the proceeding…</button> : null}
          </div>
        </div>
      ) : null}
      {error && !form ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: '6px 0 0' }}>{error}</p> : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.title}?`}
          body="The hold on its documents lifts. The row is kept on the record as removed."
          confirmLabel="Remove it"
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
