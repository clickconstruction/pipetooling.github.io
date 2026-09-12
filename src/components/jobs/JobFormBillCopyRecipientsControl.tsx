import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { isPlausibleEmail, type BillCopyContact, type BillCopyOtherParty } from '../../lib/jobs/billCopyRecipients'
import GcHardHatIcon from '../icons/GcHardHatIcon'

/**
 * "Bills also go to" (v2.3358): who gets a COPY of every bill on this job,
 * remembered. Two kinds of people, two homes:
 *
 *   - the payer's contact persons, each with a "gets every bill" tick that
 *     writes `customer_contact_persons.gets_bill_copies` straight away (like
 *     the GC billing email row — the office discovers the AP clerk while
 *     billing, not while filing the customer);
 *   - the other party on the job (the GC on a customer-pays job, the customer
 *     on a GC-pays job) — a job flag the shell owns (identity autosave slice).
 *
 * A person who is not on file yet is added right here as a contact of the
 * payer, already ticked. Bill Customer pre-ticks everything this row shows.
 */

type ContactRow = { id: string; name: string | null; email: string | null; gets_bill_copies: boolean | null }

export function useBillCopyContacts(customerId: string | null): {
  contacts: BillCopyContact[]
  loaded: boolean
  reload: () => Promise<void>
  setFlag: (id: string, on: boolean) => Promise<boolean>
  add: (name: string, email: string) => Promise<boolean>
} {
  const { showToast } = useToastContext()
  const [contacts, setContacts] = useState<BillCopyContact[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!customerId) {
      setContacts([])
      setLoaded(true)
      return
    }
    const { data } = await supabase
      .from('customer_contact_persons')
      .select('id, name, email, gets_bill_copies')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })
    setContacts(
      ((data ?? []) as ContactRow[]).map((c) => ({
        id: c.id,
        name: (c.name ?? '').trim(),
        email: (c.email ?? '').trim(),
        getsBillCopies: c.gets_bill_copies === true,
      })),
    )
    setLoaded(true)
  }, [customerId])

  useEffect(() => {
    setLoaded(false)
    void reload()
  }, [reload])

  const setFlag = useCallback(
    async (id: string, on: boolean) => {
      // Optimistic: the tick answers at once; a refusal puts it back and says why.
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, getsBillCopies: on } : c)))
      const { error } = await supabase.from('customer_contact_persons').update({ gets_bill_copies: on }).eq('id', id)
      if (error) {
        setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, getsBillCopies: !on } : c)))
        showToast(`Could not save who gets bills: ${error.message}`, 'error')
        return false
      }
      return true
    },
    [showToast],
  )

  const add = useCallback(
    async (name: string, email: string) => {
      if (!customerId) return false
      const { error } = await supabase
        .from('customer_contact_persons')
        .insert({ customer_id: customerId, name: name.trim(), email: email.trim(), gets_bill_copies: true })
      if (error) {
        showToast(`Could not add the contact: ${error.message}`, 'error')
        return false
      }
      await reload()
      return true
    },
    [customerId, reload, showToast],
  )

  return { contacts, loaded, reload, setFlag, add }
}

const inputStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text)',
  minWidth: 0,
}

const tickRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', padding: '0.15rem 0', cursor: 'pointer' }

export function JobFormBillCopyRecipientsControl({
  payerName,
  contacts,
  loaded,
  onSetFlag,
  onAdd,
  otherParty,
  copyOtherParty,
  setCopyOtherParty,
  canAdd,
}: {
  /** Whose contacts these are — the customer, or the GC when the GC pays. */
  payerName: string
  contacts: BillCopyContact[]
  loaded: boolean
  onSetFlag: (id: string, on: boolean) => Promise<boolean>
  onAdd: (name: string, email: string) => Promise<boolean>
  /** The party not billed on this job; null when the job has no distinct GC or is split by line. */
  otherParty: BillCopyOtherParty | null
  copyOtherParty: boolean
  setCopyOtherParty: (v: boolean) => void
  /** False until the job has a payer customers row to hang a contact on. */
  canAdd: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const emailOk = isPlausibleEmail(email)

  async function submitAdd() {
    if (busy || !name.trim() || !emailOk) return
    setBusy(true)
    const ok = await onAdd(name, email)
    setBusy(false)
    if (ok) {
      setName('')
      setEmail('')
      setAdding(false)
    }
  }

  const withEmail = contacts.filter((c) => isPlausibleEmail(c.email))
  const withoutEmail = contacts.length - withEmail.length

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.3rem' }}>Who else gets every bill on this job</div>
      {otherParty ? (
        <label style={tickRow}>
          <input type="checkbox" checked={copyOtherParty} onChange={(e) => setCopyOtherParty(e.target.checked)} aria-label={`Copy ${otherParty.name}`} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            {otherParty.role === 'gc' ? <GcHardHatIcon size={11} /> : null}
            <span style={{ fontWeight: 600 }}>{otherParty.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {otherParty.email || 'no email on file'} · {otherParty.role === 'gc' ? 'the GC, not billed' : 'the customer, not billed'}
            </span>
          </span>
        </label>
      ) : null}
      {withEmail.map((c) => (
        <label key={c.id} style={tickRow}>
          <input type="checkbox" checked={c.getsBillCopies} onChange={(e) => void onSetFlag(c.id, e.target.checked)} aria-label={`${c.name || c.email} gets every bill`} />
          <span>
            <span style={{ fontWeight: 600 }}>{c.name || c.email}</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {c.name ? c.email : ''} · contact on {payerName}
            </span>
          </span>
        </label>
      ))}
      {loaded && withEmail.length === 0 && !otherParty ? (
        <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nobody yet — only {payerName} gets the bill.</p>
      ) : null}
      {withoutEmail > 0 ? (
        <p style={{ margin: '0.1rem 0 0.35rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          {withoutEmail} contact{withoutEmail === 1 ? '' : 's'} on {payerName} {withoutEmail === 1 ? 'has' : 'have'} no email — add one on Edit customer → Contacts.
        </p>
      ) : null}
      {adding ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto auto', gap: '0.35rem', marginTop: '0.4rem', alignItems: 'center' }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (AP office, spouse…)" aria-label="New bill recipient name" style={inputStyle} autoFocus />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="New bill recipient email"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitAdd()
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !name.trim() || !emailOk}
            onClick={() => void submitAdd()}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', opacity: !name.trim() || !emailOk ? 0.6 : 1 }}
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button type="button" disabled={busy} onClick={() => setAdding(false)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => setAdding(true)}
          title={canAdd ? undefined : 'Pick a customer first'}
          style={{ marginTop: '0.35rem', padding: '0.3rem 0.65rem', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: canAdd ? 'var(--text-link)' : 'var(--text-faint)', cursor: canAdd ? 'pointer' : 'not-allowed' }}
        >
          + Add a person
        </button>
      )}
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Saved on {payerName}&rsquo;s customer record, so it carries to their next job. Bill Customer starts with these people ticked; untick one there to skip them on a single bill.
      </p>
    </div>
  )
}
