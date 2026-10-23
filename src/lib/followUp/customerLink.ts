/**
 * Messages, residential R7, punch list #149 (PR 2, v2.5795): **A customer we know**, the first block of *Who is this?*
 * on both boxes, and **A new customer** as one live press. The customers the app already has that a sender may be,
 * each with why, the strongest reason first: the address or the number on a customer's record or on a person at one;
 * a bid or a Pipeline job that names them, which also takes the thread; the name; the company's own domain. One guess
 * per record, its reasons joined. Pure: `newLane.ts`'s `senderFacts` reads the sender, `newLaneCardIo.ts` reads the
 * records, and `whoGuesses` puts the block first.
 */
import { normalizeChannel } from '../contacts/kernel'
import type { GuessRecord, Mailbox, SenderFacts, WhoGuess, WhoKnown } from './newLane'

/** A customer as the block reads them: the numbers and addresses on their record (`customers.contact_info`). */
export interface KnownCustomer {
  id: string
  name: string
  phones?: readonly string[]
  emails?: readonly string[]
}

/** A person at a customer (`customer_contact_persons`), with the customer's name. */
export interface KnownPerson {
  id: string
  name: string
  customerId: string
  customer: string
  phones?: readonly string[]
  emails?: readonly string[]
}

/**
 * A bid or a Pipeline job that names a contact: its key as the thread ties it, its label as the thread names it
 * ("B482 Oakhill Church Fellowship Hall"), its customer, the addresses, numbers and names it carries, and whether it
 * is still under way, which is when a press lands the thread on it.
 */
export interface NamingJob {
  key: string
  label: string
  customerId: string | null
  customer: string | null
  emails?: readonly string[]
  phones?: readonly string[]
  names?: readonly string[]
  active: boolean
}

/** What a new customer is made from, carried on the guess and finished by the card's field. */
export interface NewCustomerMake {
  /** The customer's name: the sender's, until the office types a company's. */
  customerName: string
  /** Commercial on bids@, residential on the team number. */
  customerType: 'commercial' | 'residential'
  /** The line under the field. */
  hint: string
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 2)

/**
 * True when the sender's name reads as the customer's own: every word of it is in the customer's name ("Kevin" in
 * "Kevin Alvarez"), or there is no name. False for "Kevin Alvarez" against "Alvarez Family Dental", a person at a
 * company, whom the press names as a new person there.
 */
export function samePerson(name: string | null, customerName: string): boolean {
  const w = words(name ?? '')
  if (w.length === 0) return true
  const c = new Set(words(customerName))
  return w.every((x) => c.has(x))
}

const domainOf = (email: string) => {
  const n = normalizeChannel('email', email)
  return n.slice(n.lastIndexOf('@') + 1)
}
const hasEmail = (emails: readonly string[] | undefined, address: string) => Boolean(address) && (emails ?? []).some((e) => normalizeChannel('email', e) === address)
const hasPhone = (phones: readonly string[] | undefined, number: string) => Boolean(number) && (phones ?? []).some((p) => normalizeChannel('phone', p) === number)
const hasName = (names: readonly string[] | undefined, name: string | null) => Boolean(name) && (names ?? []).some((n) => n.trim().toLowerCase() === name!.trim().toLowerCase())
const onDomain = (emails: readonly string[] | undefined, domain: string) => Boolean(domain) && (emails ?? []).some((e) => domainOf(e) === domain)

interface Hit {
  record: GuessRecord
  /** 1 on file · 2 a bid or job names them · 3 the name · 4 the last name · 5 the domain. */
  rank: number
  label: string
  whys: string[]
  newPerson: boolean
  name: string | null
  jobKey: string | null
}

const recordKey = (r: GuessRecord) => `${r.table}:${r.id}`

/** A hit on a customer's row: the customer's own person when the sender's name reads as theirs, else a new person there. */
function customerHit(c: { id: string; name: string }, rank: number, why: string, sender: SenderFacts, jobKey: string | null = null): Hit {
  const own = samePerson(sender.name, c.name)
  return {
    record: { table: 'customers', id: c.id },
    rank,
    label: own ? c.name : `${sender.name} at ${c.name}`,
    whys: [why],
    newPerson: !own,
    name: own ? null : sender.name,
    jobKey,
  }
}

function personHit(p: KnownPerson, rank: number, why: string): Hit {
  return { record: { table: 'customer_contact_persons', id: p.id }, rank, label: `${p.name} at ${p.customer}`, whys: [why], newPerson: false, name: null, jobKey: null }
}

/**
 * The customers the sender may be, the strongest reason first and one guess per record. A bid or a job that names
 * them carries its key, so the press lands the thread on it while it is under way.
 */
export function customerMatches(sender: SenderFacts, known: Pick<WhoKnown, 'customers' | 'people' | 'jobs'>): WhoGuess[] {
  const hits = new Map<string, Hit>()
  const joinWhys = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])]
  // One guess per record, its strongest reason kept. A job that names them is a fact of its own, so its line and its
  // key join a stronger hit; a weaker reason of another kind adds nothing and is dropped.
  const add = (h: Hit) => {
    const k = recordKey(h.record)
    const cur = hits.get(k)
    if (!cur) hits.set(k, h)
    else if (h.rank < cur.rank) hits.set(k, { ...h, whys: joinWhys(h.whys, cur.rank === 2 ? cur.whys : []), jobKey: h.jobKey ?? cur.jobKey })
    else if (h.rank === 2 || h.rank === cur.rank) hits.set(k, { ...cur, whys: joinWhys(cur.whys, h.whys), jobKey: cur.jobKey ?? h.jobKey })
  }
  const customers = known.customers ?? []
  const people = known.people ?? []
  const onFile = sender.address ? 'This address is on their record.' : 'This number is on their record.'

  // 1. The address or the number on file.
  for (const c of customers) if (hasEmail(c.emails, sender.address) || hasPhone(c.phones, sender.number)) add(customerHit(c, 1, onFile, sender))
  for (const p of people) if (hasEmail(p.emails, sender.address) || hasPhone(p.phones, sender.number)) add(personHit(p, 1, onFile))
  // A person already matched at a customer: a job or a domain on that customer is theirs, not a second person's.
  const personAt = (customerId: string): string | null => {
    const p = people.find((x) => x.customerId === customerId && hits.has(recordKey({ table: 'customer_contact_persons', id: x.id })))
    return p ? recordKey({ table: 'customer_contact_persons', id: p.id }) : null
  }

  // 2. A bid or a job that names them: its customer, and the thread on it while it is under way.
  for (const j of known.jobs ?? []) {
    if (!j.customerId || !j.customer) continue
    if (!(hasEmail(j.emails, sender.address) || hasPhone(j.phones, sender.number) || hasName(j.names, sender.name))) continue
    const why = j.active ? `Named on ${j.label}. The thread lands on it.` : `Named on ${j.label}.`
    const jobKey = j.active ? j.key : null
    const theirs = personAt(j.customerId)
    if (theirs) {
      const cur = hits.get(theirs)!
      hits.set(theirs, { ...cur, whys: joinWhys(cur.whys, [why]), jobKey: cur.jobKey ?? jobKey })
    } else add(customerHit({ id: j.customerId, name: j.customer }, 2, why, sender, jobKey))
  }

  // 3. The whole name, then 4. the last name, as the team line guessed before.
  const name = sender.name
  if (name) {
    const w = words(name)
    if (w.length >= 2) {
      for (const c of customers) if (samePerson(name, c.name)) add(customerHit(c, 3, 'A customer with this name.', sender))
      for (const p of people) if (samePerson(name, p.name)) add(personHit(p, 3, 'A person at the customer with this name.'))
    }
    // The last word is the last name: "Kevin Alvarez", "Mary Ann Smith".
    const last = w.length >= 2 ? w[w.length - 1] : undefined
    if (last && last.length >= 3) {
      for (const c of customers) {
        if (!words(c.name).includes(last)) continue
        add(customerHit(c, 4, (c.phones ?? []).length ? 'A customer with this last name.' : 'A customer with this last name and no cell on file.', sender))
      }
    }
  }

  // 5. The company's own domain: someone new at that customer, the sender's name kept on the thread.
  if (sender.domain) {
    const why = `Same company address, @${sender.domain}. The name stays on the thread.`
    const newThere = (c: { id: string; name: string }): Hit => ({
      record: { table: 'customers', id: c.id },
      rank: 5,
      label: name ? `${name} at ${c.name}` : `Someone new at ${c.name}`,
      whys: [why],
      newPerson: true,
      name,
      jobKey: null,
    })
    for (const c of customers) if (!personAt(c.id) && onDomain(c.emails, sender.domain)) add(newThere(c))
    for (const p of people) if (!personAt(p.customerId) && onDomain(p.emails, sender.domain)) add(newThere({ id: p.customerId, name: p.customer }))
  }

  return [...hits.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map((h) => ({ kind: 'customer', label: h.label, words: h.whys.join(' '), record: h.record, newPerson: h.newPerson, name: h.name, jobKey: h.jobKey }))
}

/**
 * *A new customer*, one live press: the customer made from the sender's name, address and number, the thread moved
 * to them. The card's field starts with the sender's name; a company typed there makes the company the customer and
 * keeps the sender as the person on the thread.
 */
export function newCustomerGuess(sender: SenderFacts, box: Mailbox | null): WhoGuess {
  const first = sender.name?.split(' ')[0] ?? ''
  return {
    kind: 'customer',
    label: sender.name ? `${sender.name}, a new customer` : 'A new customer',
    words: `Makes the customer with this ${sender.address ? 'address' : 'number'}. The thread moves to them.`,
    record: null,
    newPerson: false,
    name: sender.name,
    makes: {
      customerName: sender.name ?? '',
      customerType: box === 'bids' ? 'commercial' : 'residential',
      hint: first ? `A company? Type its name. ${first} stays the person on the thread.` : 'Type their name, or the company they are at.',
    },
  }
}
