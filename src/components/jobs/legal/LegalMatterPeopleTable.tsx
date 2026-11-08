import { useState, type CSSProperties } from 'react'
import ConfirmDialog from '../../ConfirmDialog'
import {
  LEGAL_PERSON_ROLES,
  LEGAL_PERSON_USES,
  PEOPLE_EMPTY_WORDS,
  PEOPLE_SEED_LABEL,
  emptyPersonDraft,
  personDraftOf,
  personDraftProblem,
  personRoleWords,
  personUseWords,
  reachWords,
  seededFromWords,
  type LegalMatterPersonLike,
  type LegalPersonDraft,
  type LegalPersonRole,
  type LegalPersonUse,
} from '../../../lib/legal/legalMatterPeople'
import { MUTED, TD, TH, btn, btnPrimary, pill, SectionTitle } from './legalDeskShared'

/**
 * The people on the matter (punch list #174, v2.6705), on the Account tab under the record's contacts: who, their
 * role and organization, how to reach them, and how letters use them — letters (a To), copies, or never with the
 * reason written on the row. The first rows come from the record (the customer, its contacts, each property's owner
 * of record) through *Add the people the record knows*; the office adds, edits and removes the rest. The letters pick
 * their recipients from this list (`letterRecipients`), so a bounced inbox or a witness is refused where the letter is
 * written, not re-learned on each send.
 */

/** What the desk hands the list beyond the rows: the office's acts (null when read only). */
export type PeoplePanel = {
  acts: {
    /** Add (personId null) or edit a person; resolves to the refusal's words, or null when it took. */
    save: (draft: LegalPersonDraft, personId: string | null) => Promise<string | null>
    remove: (personId: string) => Promise<string | null>
    /** Seed the list from the record; resolves to the refusal's words, or null when it took. */
    seed: () => Promise<string | null>
    /** The record knows at least one person to seed. */
    canSeed: boolean
  } | null
}

const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.84rem', padding: '4px 6px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }
const LABEL: CSSProperties = { ...MUTED, fontSize: '0.72rem', display: 'grid', gap: 2 }

type Form = { personId: string | null; draft: LegalPersonDraft }

export default function LegalMatterPeopleTable({ people, panel }: { people: ReadonlyArray<LegalMatterPersonLike>; panel: PeoplePanel }) {
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<LegalMatterPersonLike | null>(null)
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
    const problem = personDraftProblem(form.draft)
    if (problem) {
      setError(problem)
      return
    }
    if (await act(() => acts.save(form.draft, form.personId))) setForm(null)
  }
  const remove = async () => {
    if (!removing || !acts) return
    const id = removing.id
    setRemoving(null)
    if (await act(() => acts.remove(id))) setForm((f) => (f?.personId === id ? null : f))
  }
  const patch = (p: Partial<LegalPersonDraft>) => setForm((f) => (f ? { ...f, draft: { ...f.draft, ...p } } : f))
  const toneOf = (use: LegalPersonUse) => (use === 'letters' ? 'ok' : use === 'copies' ? 'neutral' : 'stop')

  return (
    <div data-legal-people>
      <SectionTitle doors={pill('the letters pick from this list', 'neutral')}>People on the matter</SectionTitle>
      {people.length === 0 ? (
        <p data-legal-people-empty style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0 6px' }}>{PEOPLE_EMPTY_WORDS}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Who</th>
                <th style={TH}>Role</th>
                <th style={TH}>Reach</th>
                <th style={TH}>Use</th>
                <th style={TH} aria-label="Edit" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} data-legal-person={p.id} data-legal-person-use={p.use}>
                  <td style={TD}>
                    <b>{p.name}</b>
                    {p.organization && p.organization !== p.name ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>{p.organization}</div> : null}
                    {p.seededFrom ? <div style={{ ...MUTED, fontSize: '0.72rem' }}>{seededFromWords(p.seededFrom)}</div> : null}
                  </td>
                  <td style={TD}>{personRoleWords(p.role)}</td>
                  <td style={TD}>
                    {reachWords(p)}
                    {p.email && p.mailingAddress ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>{p.mailingAddress}</div> : null}
                  </td>
                  <td style={TD}>{pill(personUseWords(p.use, p.reason), toneOf(p.use))}</td>
                  <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {acts ? <button type="button" onClick={() => { setError(null); setForm({ personId: p.id, draft: personDraftOf(p) }) }} style={{ ...btn, height: 22, fontSize: '0.72rem' }}>Edit</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {acts && !form ? (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {acts.canSeed ? <button type="button" data-legal-people-seed onClick={() => void act(() => acts.seed())} disabled={busy} style={btn}>{PEOPLE_SEED_LABEL}</button> : null}
          <button type="button" data-legal-people-add onClick={() => { setError(null); setForm({ personId: null, draft: emptyPersonDraft() }) }} style={btn}>＋ Add a person</button>
        </div>
      ) : null}
      {form && acts ? (
        <div data-legal-people-form style={{ marginTop: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: '0.84rem' }}>{form.personId ? 'Edit the person' : 'Add a person'}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Name
              <input value={form.draft.name} onChange={(e) => patch({ name: e.target.value })} style={INPUT} data-legal-person-name placeholder="R. Calloway" />
            </label>
            <label style={LABEL}>
              Role
              <select value={form.draft.role} onChange={(e) => patch({ role: e.target.value as LegalPersonRole })} style={INPUT} data-legal-person-role>
                {LEGAL_PERSON_ROLES.map((r) => <option key={r} value={r}>{personRoleWords(r)}</option>)}
              </select>
            </label>
            <label style={LABEL}>
              Organization
              <input value={form.draft.organization} onChange={(e) => patch({ organization: e.target.value })} style={INPUT} data-legal-person-organization placeholder="Sable Ridge Builders" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <label style={LABEL}>
              Email
              <input value={form.draft.email} onChange={(e) => patch({ email: e.target.value })} style={INPUT} data-legal-person-email inputMode="email" />
            </label>
            <label style={LABEL}>
              Phone
              <input value={form.draft.phone} onChange={(e) => patch({ phone: e.target.value })} style={INPUT} data-legal-person-phone inputMode="tel" />
            </label>
            <label style={LABEL}>
              Mailing address
              <input value={form.draft.mailingAddress} onChange={(e) => patch({ mailingAddress: e.target.value })} style={INPUT} data-legal-person-address placeholder="PO Box 418, Brenham TX" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: 8 }}>
            <label style={LABEL}>
              Letters
              <select value={form.draft.use} onChange={(e) => patch({ use: e.target.value as LegalPersonUse })} style={INPUT} data-legal-person-use>
                {LEGAL_PERSON_USES.map((u) => <option key={u} value={u}>{u === 'letters' ? 'letters go to them' : u === 'copies' ? 'they get a copy' : 'never'}</option>)}
              </select>
            </label>
            <label style={LABEL}>
              {form.draft.use === 'never' ? 'Why never' : 'Note'}
              <input value={form.draft.reason} onChange={(e) => patch({ reason: e.target.value })} style={INPUT} data-legal-person-reason placeholder={form.draft.use === 'never' ? 'a witness, not a recipient · bounces' : ''} />
            </label>
          </div>
          {error ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: 0 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void save()} disabled={busy} style={btnPrimary} data-legal-person-save>Save the person</button>
            <button type="button" onClick={() => { setForm(null); setError(null) }} disabled={busy} style={btn}>Cancel</button>
            {form.personId ? <button type="button" onClick={() => setRemoving(people.find((p) => p.id === form.personId) ?? null)} disabled={busy} style={{ ...btn, marginLeft: 'auto', color: '#b42318' }} data-legal-person-remove>Take them off the matter…</button> : null}
          </div>
        </div>
      ) : null}
      {error && !form ? <p role="alert" style={{ color: '#9a6700', fontSize: '0.8rem', margin: '6px 0 0' }}>{error}</p> : null}
      {removing ? (
        <ConfirmDialog
          title={`Take ${removing.name} off the matter?`}
          body="Letters stop offering them. The row is kept on the record as removed."
          confirmLabel="Take them off"
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
