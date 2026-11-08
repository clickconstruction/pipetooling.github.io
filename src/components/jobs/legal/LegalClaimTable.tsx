import { useState, type CSSProperties, type ReactNode } from 'react'
import ConfirmDialog from '../../ConfirmDialog'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import {
  CLAIM_TYPED_EMPTY_WORDS,
  LEGAL_CLAIM_LINE_KINDS,
  claimEvidenceWords,
  claimLineDraftOf,
  claimLineDraftProblem,
  claimLineKindWords,
  claimTotalWords,
  emptyClaimLineDraft,
  type ClaimTable,
  type ClaimTableRow,
  type LegalClaimLineDraft,
  type LegalClaimLineKind,
} from '../../../lib/legal/legalClaimLines'
import { MUTED, NUM, TD, TH, btn, btnPrimary, pill, Door, SectionTitle } from './legalDeskShared'

/**
 * The claim on the Account tab (punch list #171, v2.6679): one table, the two rows that fill in on their own (the open
 * bills from AR, the retainage held from the job) above the lines the office types — materials left on site, damages,
 * interest, attorney fees — each with its amount, its basis and the Evidence document behind it, and the total the
 * claim comes to. The office adds, edits and removes a typed line here; the kernel (`legalClaimLines.ts`) draws the
 * rows and checks a draft, and the RPCs hold the same rules.
 */

/** What the desk hands the table beyond the rows: the documents to pick from, the office's acts (null when read only), the doors. */
export type ClaimPanel = {
  documents: ReadonlyArray<{ id: string; title: string }>
  acts: {
    /** Add (lineId null) or edit a line; resolves to the refusal's words, or null when it took. */
    save: (draft: LegalClaimLineDraft, lineId: string | null) => Promise<string | null>
    remove: (lineId: string) => Promise<string | null>
  } | null
  onOpenDocument?: (documentId: string) => void
  onOpenJob?: (jobId: string) => void
  onOpenAccountsReceivable?: () => void
}

const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.84rem', padding: '4px 6px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }
const LABEL: CSSProperties = { ...MUTED, fontSize: '0.72rem', display: 'grid', gap: 2 }

type Form = { lineId: string | null; draft: LegalClaimLineDraft }

export default function LegalClaimTable({ table, panel }: { table: ClaimTable; panel: ClaimPanel }) {
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ClaimTableRow | null>(null)
  const acts = panel.acts

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
    const problem = claimLineDraftProblem(form.draft)
    if (problem) {
      setError(problem)
      return
    }
    if (await act(() => acts.save(form.draft, form.lineId))) setForm(null)
  }
  const remove = async () => {
    if (!removing?.line || !acts) return
    const id = removing.line.id
    setRemoving(null)
    if (await act(() => acts.remove(id))) setForm((f) => (f?.lineId === id ? null : f))
  }
  const patch = (p: Partial<LegalClaimLineDraft>) => setForm((f) => (f ? { ...f, draft: { ...f.draft, ...p } } : f))
  const pickKind = (kind: LegalClaimLineKind) =>
    setForm((f) => {
      if (!f) return f
      // A name the office has not touched follows the kind; a typed one stays.
      const untouched = f.draft.title === '' || (LEGAL_CLAIM_LINE_KINDS as readonly string[]).some((k) => claimLineKindWords(k as LegalClaimLineKind) === f.draft.title)
      return { ...f, draft: { ...f.draft, kind, title: untouched ? emptyClaimLineDraft(kind).title : f.draft.title } }
    })

  const evidenceCell = (r: ClaimTableRow): ReactNode => {
    const e = r.evidence
    if (e.kind === 'document' && panel.onOpenDocument) {
      const open = panel.onOpenDocument
      return <button type="button" onClick={() => open(e.documentId)} style={{ ...btn, height: 22, fontSize: '0.72rem' }} title="Open the document">{e.title} ›</button>
    }
    if (e.kind === 'job' && panel.onOpenJob && e.jobIds[0]) {
      const open = panel.onOpenJob
      const first = e.jobIds[0]
      return <button type="button" onClick={() => open(first)} style={{ ...btn, height: 22, fontSize: '0.72rem' }} title="Open the job">{claimEvidenceWords(e)} ›</button>
    }
    return <span style={MUTED}>{claimEvidenceWords(e)}</span>
  }
  const typedRows = table.rows.filter((r) => r.source === 'typed')

  return (
    <div data-legal-claim-table>
      <SectionTitle doors={panel.onOpenAccountsReceivable ? <Door label="Accounts Receivable" onClick={panel.onOpenAccountsReceivable} /> : null}>The claim</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Part of the claim</th>
              <th style={TH}>Basis</th>
              <th style={TH}>Evidence</th>
              <th style={{ ...TH, textAlign: 'right' }}>Amount</th>
              <th style={TH} aria-label="Edit" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.key} data-legal-claim-row={r.source} data-legal-claim-line={r.line?.id}>
                <td style={TD}>
                  <b>{r.part}</b>
                  {r.source !== 'typed' ? <> {pill('fills in', 'neutral')}</> : null}
                </td>
                <td style={{ ...TD, ...(r.source !== 'typed' ? MUTED : null) }}>{r.basis || <span style={MUTED}>—</span>}</td>
                <td style={TD}>{evidenceCell(r)}</td>
                <td style={{ ...TD, ...NUM }}>{formatLegalMoney(r.amount)}</td>
                <td style={{ ...TD, ...NUM }}>
                  {r.line && acts ? <button type="button" onClick={() => { setError(null); setForm({ lineId: r.line!.id, draft: claimLineDraftOf(r.line!) }) }} style={{ ...btn, height: 22, fontSize: '0.72rem' }}>Edit</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-legal-claim-total>
              <td colSpan={3} style={{ ...TD, borderTop: '2px solid var(--border-strong)', borderBottom: 'none', fontWeight: 700 }}>{claimTotalWords(table)}</td>
              <td style={{ ...TD, ...NUM, borderTop: '2px solid var(--border-strong)', borderBottom: 'none', fontWeight: 700 }}>{formatLegalMoney(table.total)}</td>
              <td style={{ ...TD, borderTop: '2px solid var(--border-strong)', borderBottom: 'none' }} />
            </tr>
          </tfoot>
        </table>
      </div>
      {table.note ? <p style={{ ...MUTED, fontSize: '0.78rem', margin: '6px 0 0' }}>{table.note}</p> : null}
      {typedRows.length === 0 && acts && !form ? <p style={{ ...MUTED, fontSize: '0.78rem', margin: '6px 0 0' }}>{CLAIM_TYPED_EMPTY_WORDS}</p> : null}
      {acts && !form ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" data-legal-claim-add onClick={() => { setError(null); setForm({ lineId: null, draft: emptyClaimLineDraft() }) }} style={btn}>＋ Add a claim line</button>
        </div>
      ) : null}
      {form && acts ? (
        <div data-legal-claim-form style={{ marginTop: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: '0.84rem' }}>{form.lineId ? 'Edit the claim line' : 'Add a claim line'}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Part of the claim
              <select value={form.draft.kind} onChange={(e) => pickKind(e.target.value as LegalClaimLineKind)} style={INPUT} data-legal-claim-kind>
                {LEGAL_CLAIM_LINE_KINDS.map((k) => <option key={k} value={k}>{claimLineKindWords(k)}</option>)}
              </select>
            </label>
            <label style={LABEL}>
              Name
              <input value={form.draft.title} onChange={(e) => patch({ title: e.target.value })} style={INPUT} data-legal-claim-title placeholder="Materials left on site" />
            </label>
            <label style={LABEL}>
              Amount
              <input value={form.draft.amount} onChange={(e) => patch({ amount: e.target.value })} style={{ ...INPUT, ...NUM, textAlign: 'right' }} inputMode="decimal" data-legal-claim-amount placeholder="0.00" />
            </label>
          </div>
          <label style={LABEL}>
            Basis
            <input value={form.draft.basis} onChange={(e) => patch({ basis: e.target.value })} style={INPUT} data-legal-claim-basis placeholder="contract ¶ 9 · counted on walk-off, or the statute" />
          </label>
          <label style={LABEL}>
            Evidence document
            <select value={form.draft.documentId ?? ''} onChange={(e) => patch({ documentId: e.target.value || null })} style={INPUT} data-legal-claim-document>
              <option value="">None yet</option>
              {panel.documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </label>
          {error ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: 0 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void save()} disabled={busy} style={btnPrimary} data-legal-claim-save>Save the line</button>
            <button type="button" onClick={() => { setForm(null); setError(null) }} disabled={busy} style={btn}>Cancel</button>
            {form.lineId ? <button type="button" onClick={() => setRemoving(table.rows.find((r) => r.line?.id === form.lineId) ?? null)} disabled={busy} style={{ ...btn, marginLeft: 'auto', color: '#b42318' }} data-legal-claim-remove>Remove the line…</button> : null}
          </div>
        </div>
      ) : null}
      {error && !form ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: '6px 0 0' }}>{error}</p> : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.part} from the claim?`}
          body={`${formatLegalMoney(removing.amount)} leaves the claim. The row is kept on the record as removed.`}
          confirmLabel="Remove the line"
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
