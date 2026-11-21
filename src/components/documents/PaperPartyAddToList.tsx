import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  ADD_TO_A_LIST_LABEL,
  addToListTitle,
  addedToListWords,
  listChoiceRefusal,
  listConfirmLabel,
  listMadeKey,
  listOptions,
  listPlan,
  papersComeWords,
  writeOnce,
  type ListChoice,
  type ListPlan,
  type MadeRecord,
} from '../../lib/documents/paperPartyList'
import type { PartyBusiness, PartyCustomer, PartySupplyHouse } from '../../lib/documents/paperPartyPick'
import { addSupplyHouse, keepSignerWithBusiness, namePartyContact, readListPerson, readPartyPaperNames, readPartyShortLists, searchPartyCustomers, type ListPersonRead } from '../../lib/documents/paperPartyIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import NewCustomerForm from '../NewCustomerForm'
import OfflineRetryPanel from '../OfflineRetryPanel'

/**
 * Documents → Agreements, **Add to a list** (punch list #403, step 3, the second PR). A paper that went to someone on
 * no list reads *Not on a list* until the office says what they are. This window asks: a new customer, a new supply
 * house or vendor, or someone at a company the app already keeps. The paper points at their contact, so it comes with
 * them and nothing is copied (`name_contact`, the act Messages calls *Who is this?*).
 *
 * A new customer is made in the app's own New customer form, opened on their name, so a customer is made one way.
 * Nothing is written until the last press. A press that fails partway leaves the window open, and the next press goes
 * on from what the first one wrote: it never makes a second supply house, customer or person on file.
 */

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }
const box: CSSProperties = { background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 440px)', maxHeight: 'min(86vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }
const field: CSSProperties = { display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const optionRow: CSSProperties = { display: 'flex', gap: '0.55rem', alignItems: 'flex-start', padding: '0.5rem 0.55rem', border: '1px solid var(--border)', borderRadius: 8, marginTop: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }
const optionOn: CSSProperties = { ...optionRow, border: '1px solid #3b82f6', background: 'var(--bg-blue-tint)' }
const quietPress: CSSProperties = { padding: '0.5rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }
const mainPress: CSSProperties = { padding: '0.5rem 0.9rem', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: 'white', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }
const mainPressBusy: CSSProperties = { ...mainPress, background: DEAD_PRESS_FILL, border: '1px solid var(--border-strong)', color: DEAD_PRESS_TEXT, cursor: 'wait' }

export function PaperPartyAddToList({
  documentId,
  onClose,
  onAdded,
}: {
  /** The paper whose party is on no list. */
  documentId: string
  onClose: () => void
  /** They are on a list: the words to say, and the list reads again. */
  onAdded: (words: string) => void
}) {
  const { user } = useAuth()
  const [person, setPerson] = useState<ListPersonRead | null>(null)
  const [paperNames, setPaperNames] = useState<string[]>([])
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [choice, setChoice] = useState<ListChoice>('customer')
  const [company, setCompany] = useState('')
  const [picked, setPicked] = useState<PartyBusiness | null>(null)
  const [typed, setTyped] = useState('')
  const [houses, setHouses] = useState<PartySupplyHouse[]>([])
  const [customers, setCustomers] = useState<PartyCustomer[]>([])
  const [housesFailure, setHousesFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [housesAttempt, setHousesAttempt] = useState(0)
  const [customersFailure, setCustomersFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [customersAttempt, setCustomersAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The app's own New customer form, open on the plan it finishes. */
  const [newCustomer, setNewCustomer] = useState<Extract<ListPlan, { kind: 'new-customer' }> | null>(null)
  /** What earlier presses wrote: the supply house, the customer and the person kept, each by what it was for. */
  const made = useRef(new Map<string, MadeRecord>())

  // Who they are and which papers come with them, read when the window opens.
  useEffect(() => {
    let live = true
    setFailure(null)
    readListPerson(documentId)
      .then(async (read) => {
        const names = await readPartyPaperNames(read.contactId)
        if (!live) return
        setPerson(read)
        setCompany(read.company)
        setPaperNames(names)
      })
      .catch((e: unknown) => live && setFailure(recoveryFailureFromError(e, 'Their paper did not read.')))
    return () => {
      live = false
    }
  }, [documentId, attempt])

  // A company the app already keeps: the supply houses are a short list, and a customer is found by name. A read that
  // fails says so and offers to read again, so a lost signal never reads as a company the app does not keep.
  const searching = choice === 'existing'
  useEffect(() => {
    setHousesFailure(null)
    if (!searching) return
    let live = true
    readPartyShortLists().then(
      (lists) => live && setHouses(lists.supplyHouses),
      (e: unknown) => {
        if (!live) return
        setHouses([])
        setHousesFailure(recoveryFailureFromError(e, 'The supply houses did not read.'))
      },
    )
    return () => {
      live = false
    }
  }, [searching, housesAttempt])
  useEffect(() => {
    // A new keystroke or a Retry starts over: the old failure goes.
    setCustomersFailure(null)
    if (!searching || typed.trim().length < 2) {
      setCustomers([])
      return
    }
    let live = true
    const timer = setTimeout(() => {
      searchPartyCustomers(typed).then(
        (found) => live && setCustomers(found),
        (e: unknown) => {
          if (!live) return
          setCustomers([])
          setCustomersFailure(recoveryFailureFromError(e, 'The customers did not read.'))
        },
      )
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [searching, typed, customersAttempt])

  const who = useMemo(() => ({ name: person?.name ?? '', email: person?.email ?? '', company }), [person, company])
  const options = useMemo(() => listOptions(who), [who])
  const found = useMemo<PartyBusiness[]>(() => {
    const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    const matches = (name: string) => words.every((w) => name.toLowerCase().includes(w))
    return [
      ...customers.map((c): PartyBusiness => ({ table: 'customers', id: c.id, name: c.name, party: 'customer' })),
      ...houses.filter((h) => matches(h.name)).map((h): PartyBusiness => ({ table: 'supply_houses', id: h.id, name: h.name, party: 'supply_house' })),
    ]
  }, [customers, houses, typed])

  /** Keep the signer with a company once: a press after a failure finds the row the first press kept. */
  const keepOnce = (business: PartyBusiness, signer: { name: string; email: string }) =>
    writeOnce(made.current, listMadeKey('kept', [business.table, business.id, signer.name, signer.email]), () => keepSignerWithBusiness(business, signer, user?.id))

  /** Put them on the list: keep them under the company when there is one, then say what their contact is. */
  const finish = async (plan: ListPlan, customerId: string | null) => {
    if (!person) return
    setBusy(true)
    setError(null)
    try {
      let where: string
      if (plan.kind === 'new-customer') {
        if (!customerId) return
        const business: PartyBusiness = { table: 'customers', id: customerId, name: plan.customerName, party: 'customer' }
        const record = plan.person ? await keepOnce(business, plan.person) : { table: 'customers' as const, id: customerId }
        await namePartyContact(person.contactId, record, 'customer')
        where = plan.customerName
      } else if (plan.kind === 'new-supply-house') {
        const house = await writeOnce(made.current, listMadeKey('house', [plan.houseName]), async () => ({ table: 'supply_houses', id: await addSupplyHouse(plan.houseName) }))
        const business: PartyBusiness = { table: 'supply_houses', id: house.id, name: plan.houseName, party: 'supply_house' }
        // A rep is kept by their address. With none on the paper, they are named on the house's own row.
        const record = plan.person.email ? await keepOnce(business, plan.person) : { table: 'supply_houses' as const, id: house.id }
        await namePartyContact(person.contactId, record, 'supply_house', plan.person.email ? undefined : plan.person.name)
        where = plan.houseName
      } else {
        const keepsARow = plan.business.table === 'customers' || plan.person.email !== ''
        const record = keepsARow ? await keepOnce(plan.business, plan.person) : { table: plan.business.table, id: plan.business.id }
        await namePartyContact(person.contactId, record, plan.business.party, keepsARow ? undefined : plan.person.name)
        where = plan.business.name
      }
      onAdded(addedToListWords(person, where, paperNames.length))
    } catch (e) {
      setError(formatErrorMessage(e, 'They were not added to the list.'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = () => {
    const refusal = listChoiceRefusal(choice, who, picked)
    if (refusal) {
      setError(refusal)
      return
    }
    const plan = listPlan(choice, who, picked)
    if (!plan) return
    setError(null)
    if (plan.kind === 'new-customer') {
      // A customer is made in the app's own form, on their name. The rest happens once it is saved. One an earlier
      // press saved is theirs already, so the form opens once and a press after a failure goes on from it.
      const saved = made.current.get(listMadeKey('customer', [plan.customerName]))
      if (saved) void finish({ ...plan, customerName: saved.name ?? plan.customerName }, saved.id)
      else setNewCustomer(plan)
    } else void finish(plan, null)
  }

  if (newCustomer) {
    return (
      <div style={{ ...overlay, zIndex: 1001 }}>
        <div role="dialog" aria-modal="true" aria-label="New customer" style={{ background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: 500, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
          <NewCustomerForm
            showQuickFill={false}
            mode="modal"
            initialValues={{ name: newCustomer.customerName, ...(newCustomer.person ? {} : { email: who.email }) }}
            onCancel={() => setNewCustomer(null)}
            onCreated={(customer) => {
              const plan = newCustomer
              const customerName = customer.name?.trim() || plan.customerName
              made.current.set(listMadeKey('customer', [plan.customerName]), { table: 'customers', id: customer.id, name: customerName })
              setNewCustomer(null)
              void finish({ ...plan, customerName }, customer.id)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={person ? addToListTitle(person) : ADD_TO_A_LIST_LABEL} onClick={(e) => e.stopPropagation()} style={box}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35 }}>{person ? addToListTitle(person) : ADD_TO_A_LIST_LABEL}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }}>
            ×
          </button>
        </div>
        {failure ? <OfflineRetryPanel failure={failure} onRetry={() => setAttempt((n) => n + 1)} surface="paper-party-add-to-list" idempotent /> : null}
        {!person && !failure ? <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading…</p> : null}
        {person ? (
          <>
            <p style={{ margin: '0.25rem 0 0.2rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>What are they? Their paper comes with them.</p>
            <div role="radiogroup" aria-label="What they are">
              {options.map((o) => (
                <label key={o.choice} style={choice === o.choice ? optionOn : optionRow}>
                  <input
                    type="radio"
                    name="paper-party-list-choice"
                    checked={choice === o.choice}
                    onChange={() => {
                      setChoice(o.choice)
                      setError(null)
                    }}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)' }}>{o.title}</span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.sub}</span>
                  </span>
                </label>
              ))}
            </div>
            {choice !== 'existing' ? (
              <label style={{ display: 'block', marginTop: '0.7rem', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600 }}>{choice === 'customer' ? 'Company (optional)' : 'Company'}</span>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={choice === 'customer' ? 'Leave empty when they are the customer' : 'The supply house or the vendor'} maxLength={200} autoComplete="off" style={field} />
              </label>
            ) : (
              <div style={{ marginTop: '0.7rem' }}>
                <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a customer or a supply house" aria-label="Find a customer or a supply house" style={field} />
                {housesFailure ? <OfflineRetryPanel failure={housesFailure} onRetry={() => setHousesAttempt((n) => n + 1)} surface="paper-party-add-to-list-houses" idempotent style={{ marginTop: '0.45rem' }} /> : null}
                {customersFailure ? <OfflineRetryPanel failure={customersFailure} onRetry={() => setCustomersAttempt((n) => n + 1)} surface="paper-party-add-to-list-customers" idempotent style={{ marginTop: '0.45rem' }} /> : null}
                {picked ? (
                  <p style={{ margin: '0.45rem 0 0', fontSize: '0.8125rem' }} data-testid="paper-party-list-picked">
                    They are at <strong>{picked.name}</strong>.
                  </p>
                ) : null}
                {found.map((b) => (
                  <button key={`${b.table}:${b.id}`} type="button" className="paper-party-row" onClick={() => setPicked(b)} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', width: '100%', padding: '0.45rem 0.55rem', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', color: 'var(--text-strong)' }}>
                    <span style={{ fontWeight: picked?.id === b.id ? 700 : 500, overflowWrap: 'anywhere' }}>{b.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{b.party === 'customer' ? 'Customer' : 'Supply house'}</span>
                  </button>
                ))}
              </div>
            )}
            {papersComeWords(paperNames) ? (
              <p style={{ margin: '0.7rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', fontSize: '0.8125rem' }} data-testid="paper-party-list-papers">
                {papersComeWords(paperNames)}
              </p>
            ) : null}
            {error ? (
              <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', margin: '0.6rem 0 0' }}>
                {error}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={onClose} style={quietPress}>
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={busy} style={busy ? mainPressBusy : mainPress}>
                {busy ? 'Adding…' : listConfirmLabel(choice, picked)}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default PaperPartyAddToList
