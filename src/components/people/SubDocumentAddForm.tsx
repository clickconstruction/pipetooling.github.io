import { useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { recordNavClick } from '../../lib/navClickTelemetry'
import {
  buildSubDocumentInsert,
  emptySubDocumentDraft,
  defaultSubDocumentName,
  SUB_DOCUMENT_TYPES,
  SUB_DOCUMENT_TYPES_REQUIRING_EXPIRY,
  subDocumentDraftValid,
  type SubDocumentDraft,
  type SubDocumentType,
} from '../../lib/people/subDocumentDraft'

/**
 * "Add document" for a sub — the one front door COI / W-9 / license rows have
 * (journey-map Tier-2 #33). Mounted inline by the Subs row Documents expander
 * and by Person Desk → Paperwork so both doors share the same draft, the same
 * validity rule and the same insert. Nothing is written until Save
 * (decision 17: no write on open); the type is set on the row from birth so
 * the compliance badge flips without the two-tab re-type ritual.
 */
export function SubDocumentAddForm({
  personId,
  personName,
  onSaved,
  onCancel,
}: {
  personId: string | null
  personName: string
  onSaved: () => void | Promise<void>
  onCancel: () => void
}) {
  const { user: authUser, role } = useAuth()
  const [draft, setDraft] = useState<SubDocumentDraft>(emptySubDocumentDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const validity = subDocumentDraftValid(draft)
  const needsExpiry = draft.docType !== '' && SUB_DOCUMENT_TYPES_REQUIRING_EXPIRY.has(draft.docType)

  function setType(next: string) {
    const docType = (next || '') as SubDocumentType | ''
    setDraft((d) => ({
      ...d,
      docType,
      // Keep a name the user typed; refresh a still-default one to the new type's default.
      documentName: d.documentName === '' || SUB_DOCUMENT_TYPES.some((t) => t.defaultName === d.documentName) ? (docType ? defaultSubDocumentName(docType) : '') : d.documentName,
    }))
  }

  async function save() {
    setTouched(true)
    if (!validity.ok) return
    setSaving(true)
    setError(null)
    const row = buildSubDocumentInsert(draft, { personId, personName }, new Date().toISOString(), globalThis.crypto.randomUUID())
    const { error: err } = await supabase.from('person_contract_documents').insert(row)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    recordNavClick(authUser?.id, role, 'sub_document_added', `#${row.doc_type}`)
    await onSaved()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      aria-label={`Add a document for ${personName}`}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.5rem 0.6rem', padding: '0.5rem 0.6rem', border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: '0.8125rem' }}
    >
      <Field label="What is it">
        <select value={draft.docType} onChange={(e) => setType(e.target.value)} disabled={saving} style={INPUT} autoFocus aria-label="Document type">
          <option value="">Pick a type…</option>
          {SUB_DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={needsExpiry ? 'Expires (required)' : 'Expires'}>
        <input type="date" value={draft.expiresAt} onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))} disabled={saving} style={INPUT} aria-label="Expiration date" />
      </Field>
      <Field label="Link to the file">
        <input type="url" placeholder="https://drive.google.com/…" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} disabled={saving} style={{ ...INPUT, minWidth: '14rem' }} aria-label="Link to the file" />
      </Field>
      <Field label="Name">
        <input type="text" value={draft.documentName} onChange={(e) => setDraft((d) => ({ ...d, documentName: e.target.value }))} disabled={saving} style={{ ...INPUT, minWidth: '9rem' }} aria-label="Document name" />
      </Field>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button type="submit" disabled={saving || (touched && !validity.ok)} style={{ ...BTN, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', opacity: saving || (touched && !validity.ok) ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ ...BTN, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>
      {touched && !validity.ok ? (
        <div role="alert" style={{ flexBasis: '100%', color: 'var(--text-amber-800)', fontSize: '0.75rem' }}>
          {validity.reason}
        </div>
      ) : null}
      {error ? (
        <div role="alert" style={{ flexBasis: '100%', color: 'var(--text-red-700)', fontSize: '0.75rem' }}>
          That did not save: {error}
        </div>
      ) : null}
    </form>
  )
}

const INPUT: CSSProperties = { padding: '0.2rem 0.35rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }
const BTN: CSSProperties = { padding: '0.25rem 0.7rem', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
      {label}
      {children}
    </label>
  )
}
