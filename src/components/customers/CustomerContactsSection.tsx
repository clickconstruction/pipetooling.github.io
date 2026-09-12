import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Contacts on Edit customer (customer properties train, PR 3 — v2.3009):
 * the named people at this customer — spouse, PM, AP clerk, property
 * manager — each with their own phone / email and a role note. Rows read as
 * people; Edit opens an inline sheet. Every change persists on its own
 * (`customer_contact_persons`), independent of the form's Save.
 */

type ContactRow = { id: string; name: string; phone: string | null; email: string | null; note: string | null; gets_bill_copies: boolean | null }
type ContactDraft = { name: string; phone: string; email: string; note: string; getsBillCopies: boolean }

const EMPTY: ContactDraft = { name: '', phone: '', email: '', note: '', getsBillCopies: false }

const inputStyle: CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.8125rem', minWidth: 0 }
const smallBtn: CSSProperties = { padding: '0.25rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.2rem', fontSize: '0.8125rem', color: 'var(--text-link)', fontWeight: 600 }

function draftFromRow(c: ContactRow): ContactDraft {
  return { name: c.name, phone: c.phone ?? '', email: c.email ?? '', note: c.note ?? '', getsBillCopies: c.gets_bill_copies === true }
}

export default function CustomerContactsSection({ customerId }: { customerId: string }) {
  const { showToast } = useToastContext()
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<ContactDraft>(EMPTY)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('customer_contact_persons')
      .select('id, name, phone, email, note, gets_bill_copies')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })
    setContacts((data ?? []) as ContactRow[])
    setLoaded(true)
  }, [customerId])
  useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setEditingId('new')
    setDraft(EMPTY)
  }
  function openEdit(c: ContactRow) {
    setEditingId(c.id)
    setDraft(draftFromRow(c))
  }
  function close() {
    setEditingId(null)
    setDraft(EMPTY)
  }

  async function save() {
    if (busy || !draft.name.trim()) return
    setBusy(true)
    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      note: draft.note.trim() || null,
      // Bills also go to (v2.3358): a copy recipient needs an address to copy.
      gets_bill_copies: draft.getsBillCopies && draft.email.trim().length > 0,
    }
    const { error } =
      editingId === 'new'
        ? await supabase.from('customer_contact_persons').insert({ customer_id: customerId, ...payload })
        : await supabase.from('customer_contact_persons').update(payload).eq('id', editingId ?? '')
    setBusy(false)
    if (error) {
      showToast(`Could not save the contact: ${error.message}`, 'error')
      return
    }
    close()
    await load()
  }

  async function remove(id: string) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('customer_contact_persons').delete().eq('id', id)
    setBusy(false)
    if (error) {
      showToast(`Could not remove the contact: ${error.message}`, 'error')
      return
    }
    if (editingId === id) close()
    await load()
  }

  const sheet = (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.35rem' }}>
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" aria-label="Contact name" style={inputStyle} autoFocus />
        <input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone" aria-label="Contact phone" style={inputStyle} />
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" aria-label="Contact email" style={inputStyle} />
        <input type="text" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Role (e.g. AP clerk, spouse, PM for 55 Pecan Ct)" aria-label="Contact role or note" style={inputStyle} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }} title={draft.email.trim() ? undefined : 'Needs an email'}>
        <input type="checkbox" checked={draft.getsBillCopies} disabled={!draft.email.trim()} onChange={(e) => setDraft({ ...draft, getsBillCopies: e.target.checked })} />
        <span>
          Gets a copy of every bill{' '}
          <span style={{ color: 'var(--text-muted)' }}>— Bill Customer starts with them ticked</span>
        </span>
      </label>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <button type="button" disabled={busy || !draft.name.trim()} onClick={() => void save()} style={{ ...smallBtn, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600 }}>
          {editingId === 'new' ? 'Add contact' : 'Done'}
        </button>
        <button type="button" disabled={busy} onClick={close} style={smallBtn}>
          Cancel
        </button>
        {editingId && editingId !== 'new' ? (
          <button type="button" disabled={busy} onClick={() => void remove(editingId)} style={{ ...smallBtn, marginLeft: 'auto', color: 'var(--text-red-600)' }}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <section aria-label="Contacts">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
          Contacts <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({contacts.length})</span>
        </h3>
        {editingId !== 'new' ? (
          <button type="button" onClick={openNew} style={{ ...smallBtn, marginLeft: 'auto', fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
            + Add contact
          </button>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {editingId === 'new' ? sheet : null}
        {loaded && contacts.length === 0 && editingId !== 'new' ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            More than one person at this customer? Add each with their own phone and email — invoices and contracts can go to them too.
          </p>
        ) : null}
        {contacts.map((c) =>
          editingId === c.id ? (
            <div key={c.id}>{sheet}</div>
          ) : (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</span>
                {(c.note ?? '').trim() ? (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 500, background: 'var(--bg-muted)', borderRadius: 6, padding: '0.05rem 0.45rem', color: 'var(--text-muted)' }}>{c.note}</span>
                ) : null}
                {c.gets_bill_copies === true && (c.email ?? '').trim() ? (
                  <span
                    title="Copied on every bill sent to this customer"
                    style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green-300)', borderRadius: 6, padding: '0.05rem 0.45rem', color: 'var(--text-green-700)' }}
                  >
                    gets every bill
                  </span>
                ) : null}
              </div>
              <button type="button" onClick={() => openEdit(c)} style={{ ...linkBtn, gridRow: '1 / span 2' }} aria-label={`Edit contact ${c.name}`}>
                Edit
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', minWidth: 0 }}>
                {c.phone ? (
                  <a href={`tel:${c.phone.replace(/[^+\d]/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {c.phone}
                  </a>
                ) : null}
                {c.email ? (
                  <a href={`mailto:${c.email}`} style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.email}
                  </a>
                ) : null}
                {!c.phone && !c.email ? <span style={{ color: 'var(--text-faint)' }}>no phone or email yet</span> : null}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
