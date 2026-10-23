/**
 * Messages, residential R7: the New lane on Follow up, what came in and still needs sorting before anyone answers it.
 * Lifted from the customer Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-prototype.html`
 * v0.8, screen 7, mockup A: `SORT`, `needWord`, `sortCardHtml`) and `RESIDENTIAL_BUILD_PLAN.md` → R7.
 *
 * Three sorts, one row per person, the oldest waiting first:
 * - **Who is this?** A number or an address nobody has named. The guesses come in the box's order, both boxes opening
 *   with the customers the sender may be and why (`customerLink.ts`, v2.5795): the team line then offers a lead on
 *   Prospects, then a new customer as one live press; bids@ the new customer, then a trade partner whose domain matches
 *   one on an open ask, then a new trade partner, then a supply house. A candidate and someone else close both.
 * - **Which job?** Two or more active jobs, and their newest line sits on the default job because the default took it,
 *   not a person. A check, since the line is already on a job.
 * - **Who has it?** A new line from them that nobody has answered, and nobody on the conversation. The has rule's pick
 *   comes first, passed in.
 *
 * Pure. The box a line came in on (`mailbox`, R6) and whether a person tied it (`tiedByHand`, R7's `messages.tied_by`)
 * are inputs until their columns land; a line with no box reads as the team line. The writes are the spine's
 * `name_contact` and `tie_message` and cut 2's `take_it`. `queue.ts` counts the lane on the badge later, through
 * `newLaneCount`.
 */
import { firstName, normalizeChannel, type ChannelKind, type Contact, type ContactKind } from '../contacts/kernel'
import { customerMatches, newCustomerGuess, type KnownCustomer, type KnownPerson, type NamingJob, type NewCustomerMake } from './customerLink'
import { HIRE_ROSTER_KINDS } from '../prospects/hireRosterKinds'
import { snippetOf, whenWords, type MessageChannel, type ThreadMessage } from '../messages/thread'

/** Which sort a row needs. */
export type NewSort = 'who' | 'job' | 'has'

/** The box a line came in on: the team line and inbox, or bids@ and its number (R6's `messages.mailbox`). */
export type Mailbox = 'team' | 'bids'

/** Each sort's head, the row's press and the sort card's title. */
export const SORT_HEADS: Readonly<Record<NewSort, string>> = { who: 'Who is this?', job: 'Which job?', has: 'Who has it?' }

/** The lane when nothing is waiting to be sorted. */
export const NEW_LANE_EMPTY = 'Nothing to sort. Every line that came in has a person, a job and someone on it.'

/** A person as the New lane reads them: the spine's contact, and who has the conversation (Follow up's `has`). */
export type NewLaneContact = Pick<Contact, 'id' | 'kind' | 'name' | 'company' | 'jobIds' | 'defaultJobId'> &
  Partial<Pick<Contact, 'goesBy'>> & {
    /** Who has it, by name. Null: nobody does. */
    has?: string | null
  }

/** A line as the New lane reads it: the spine's message, the box it came in on and whether a person tied it. */
export type NewLaneMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'jobId' | 'channel' | 'direction' | 'at' | 'body'> &
  Partial<Pick<ThreadMessage, 'subject'>> & {
    /** The box it came in on. Null or missing: not known yet, read as the team line. */
    mailbox?: Mailbox | null
    /** True when a person tied it to its job. False when the default job took it as it came in. */
    tiedByHand?: boolean
  }

/** One row of the New lane. */
export interface NewLaneRow {
  contactId: string
  sort: NewSort
  /** The sort's head: "Who is this?". */
  head: string
  /** Who it is from: their name, or the number or address nobody has named. */
  who: string
  kind: ContactKind
  /** The company under the name. '' for one person or a sender nobody has named. */
  company: string
  /** The line the row opens the thread at: their newest line in. */
  messageId: string
  channel: MessageChannel
  /** The line's words as a row shows them: an email's subject or first line, else the words. */
  words: string
  /** The line's whole body, which *Who is this?* reads a name from. */
  body: string
  /** When it came, ISO. The oldest is first. */
  at: string
  /** When it came, in words: "today at 8:41 AM", "yesterday". */
  when: string
  /** The box it came in on. Null: not known, read as the team line. */
  mailbox: Mailbox | null
  /** How it came in, for the row's meta line: "Text on the team number", "Email to bids@". */
  via: string
  /** Why it is in the lane, the sort card's first line. */
  why: string
  /** Their active jobs, in the rail's order. */
  jobIds: string[]
  /** The job new lines from them land on. Null: on the person. */
  defaultJobId: string | null
}

const PHONE_CHANNELS: ReadonlySet<MessageChannel> = new Set(['call', 'voicemail', 'missed', 'text'])

const CHANNEL_NOUN: Readonly<Record<MessageChannel, string>> = {
  call: 'Call',
  voicemail: 'Voicemail',
  missed: 'Missed call',
  text: 'Text',
  email: 'Email',
  note: 'Note',
  event: 'Event',
  portal: 'Their page',
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

const countWord = (n: number): string => NUMBER_WORDS[n] ?? String(n)

/** The box in words: "the team number", "the team inbox", "bids@", "the bids number". */
function boxWords(mailbox: Mailbox, channel: MessageChannel): string {
  const phone = PHONE_CHANNELS.has(channel)
  if (mailbox === 'bids') return phone ? 'the bids number' : 'bids@'
  return phone ? 'the team number' : 'the team inbox'
}

/** How a line came in: "Text on the team number", "Email to bids@", or "Text" when the box is not known. */
export function viaWords(channel: MessageChannel, mailbox: Mailbox | null | undefined): string {
  const noun = CHANNEL_NOUN[channel]
  if (!mailbox) return noun
  return `${noun} ${PHONE_CHANNELS.has(channel) ? 'on' : 'to'} ${boxWords(mailbox, channel)}`
}

/** Why a sender nobody has named is in the lane, with what the guesses put first and why. */
function whoWhy(channel: MessageChannel, mailbox: Mailbox | null): string {
  const sender = channel === 'email' ? 'An address nobody has named' : 'A number nobody has named'
  const came = mailbox ? `${sender} came in on ${boxWords(mailbox, channel)}.` : `${sender} came in.`
  if (mailbox === 'bids') return `${came} A general contractor is a customer, so the customers we know come first.`
  return `${came} Someone asking for work is a lead until they book.`
}

function jobWhy(c: NewLaneContact, activeJobs: number): string {
  return `${firstName(c)} has ${countWord(activeJobs)} active jobs. The default job took this line, so check it is the right one.`
}

const HAS_WHY = 'Nobody is on this conversation yet.'

/** Their newest line in, and whether any line of ours went to them after it. */
function newestLines(messages: readonly NewLaneMessage[]): Map<string, { lastIn: NewLaneMessage | null; lastOutAt: number }> {
  const by = new Map<string, { lastIn: NewLaneMessage | null; lastOutAt: number }>()
  for (const m of messages) {
    const cur = by.get(m.contactId) ?? { lastIn: null, lastOutAt: -Infinity }
    const at = Date.parse(m.at)
    if (m.direction === 'in' && (!cur.lastIn || at > Date.parse(cur.lastIn.at))) cur.lastIn = m
    if (m.direction === 'out' && at > cur.lastOutAt) cur.lastOutAt = at
    by.set(m.contactId, cur)
  }
  return by
}

/**
 * The New lane: one row per person, with the one sort they need. *Who is this?* wins over *Which job?*, which wins over
 * *Who has it?*, since a sender has to be named before a job or a person can be picked. The row that has waited longest
 * is first.
 */
export function newLane(
  contacts: readonly NewLaneContact[],
  messages: readonly NewLaneMessage[],
  activeJobIds: ReadonlySet<string>,
  nowIso: string,
): NewLaneRow[] {
  const lines = newestLines(messages)
  const rows: NewLaneRow[] = []
  for (const c of contacts) {
    const seen = lines.get(c.id)
    const line = seen?.lastIn
    if (!line) continue
    const active = c.jobIds.filter((id) => activeJobIds.has(id))
    const mailbox = line.mailbox ?? null
    let sort: NewSort | null = null
    let why = ''
    if (c.kind === 'unknown') {
      sort = 'who'
      why = whoWhy(line.channel, mailbox)
    } else if (active.length >= 2 && line.jobId === c.defaultJobId && !line.tiedByHand) {
      sort = 'job'
      why = jobWhy(c, active.length)
    } else if (!c.has?.trim() && Date.parse(line.at) > seen.lastOutAt) {
      sort = 'has'
      why = HAS_WHY
    }
    if (!sort) continue
    rows.push({
      contactId: c.id,
      sort,
      head: SORT_HEADS[sort],
      who: c.name,
      kind: c.kind,
      company: c.company,
      messageId: line.id,
      channel: line.channel,
      words: snippetOf({ channel: line.channel, subject: line.subject ?? null, body: line.body }),
      body: line.body,
      at: line.at,
      when: whenWords(line.at, nowIso),
      mailbox,
      via: viaWords(line.channel, mailbox),
      why,
      jobIds: active,
      defaultJobId: c.defaultJobId,
    })
  }
  return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.who.localeCompare(b.who))
}

/** The New lane's count, for the Messages badge. */
export function newLaneCount(rows: readonly NewLaneRow[]): number {
  return rows.length
}

// ---------- Who is this? ----------

/** What a guess names the sender as. Supply house and candidate are R0's kinds; team (one of our own) is v2.5546's. */
export type GuessKind = 'customer' | 'lead' | 'trade' | 'supply_house' | 'candidate' | 'team' | 'someone_else'

/** A record a guess points at. */
export type GuessRecord = { table: 'customers'; id: string } | { table: 'customer_contact_persons'; id: string } | { table: 'gc_companies'; id: string } | { table: 'people'; id: string }

/** One guess on the *Who is this?* card. */
export interface WhoGuess {
  kind: GuessKind
  /** The button: "Kevin Alvarez, a new lead on Prospects". */
  label: string
  /** What the press does, under the button. */
  words: string
  /** The record they are, or are at. Null: the press makes one, or asks who. */
  record: GuessRecord | null
  /** True when the press adds a new person at `record` rather than naming them as it. */
  newPerson: boolean
  /** The name the line gives them. Null when it gives none. */
  name: string | null
  /** A bid or a job that names them (`customerLink.ts`): the press lands the thread on it. */
  jobKey?: string | null
  /** *A new customer* (v2.5795): the press makes the customer from this, then names the contact as them. */
  makes?: NewCustomerMake
}

/** The people a guess can match, as the screen loads them. */
export interface WhoKnown {
  /** Customers, to match an address or a number on file, a name, a last name or the company's domain (`customerLink.ts`). */
  customers?: readonly KnownCustomer[]
  /** The people at customers (`customer_contact_persons`), matched the same ways. */
  people?: readonly KnownPerson[]
  /** The bids and Pipeline jobs that name the sender's address, number or name, each with its customer. */
  jobs?: readonly NamingJob[]
  /** Trade partners, with the addresses we have for them and the open ask they are on, by its name. */
  trades?: ReadonlyArray<{ id: string; company: string; contactName: string | null; emails: readonly string[]; openAsk: string | null }>
  /** The roster, subs left out and nobody archived, for *One of our own team* (v2.5546). */
  roster?: readonly RosterPerson[]
}

/** Someone on the roster who is not a sub, as *Which of ours?* lists them. */
export interface RosterPerson {
  id: string
  name: string
  /** The roster's kind: helper, assistant, estimator, superintendent, primary, master_technician. */
  kind: string
  phone: string | null
}

/** One row on *Which of ours?*: the name, and under it their role and whether the roster has a number for them. */
export interface RosterChoice {
  id: string
  name: string
  words: string
}

/** The roster as *Which of ours?* lists it: by name, each with their role and whether a number is on file. */
export function rosterChoices(roster: readonly RosterPerson[]): RosterChoice[] {
  return [...roster]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      words: `${HIRE_ROSTER_KINDS.find((k) => k.kind === p.kind)?.label ?? 'On the roster'} · ${p.phone?.trim() ? 'a number on file' : 'no number on file'}`,
    }))
}

/** The guess a pick on *Which of ours?* names the number as: this person, one of our own team. */
export function teamGuess(person: Pick<RosterChoice, 'id' | 'name'>): WhoGuess {
  return { kind: 'team', label: person.name, words: 'One of our own team. The number goes on their People record.', record: { table: 'people', id: person.id }, newPerson: false, name: person.name }
}

/** Mail services anyone can sign up for: a shared domain there says nothing about the company. */
const OPEN_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'att.net',
  'sbcglobal.net',
  'comcast.net',
  'proton.me',
  'protonmail.com',
])

/** A company's own domain from an address: "bexarsteel.example". '' for an open mail service or no address. */
export function companyDomain(address: string): string {
  const email = normalizeChannel('email', address)
  const domain = email.slice(email.lastIndexOf('@') + 1)
  return domain && !OPEN_MAIL.has(domain) ? domain : ''
}

/** What the card knows about the sender: the address and the number as given, the name, the company's own domain. */
export interface SenderFacts {
  /** The address, normalized. '' when they wrote from a number. */
  address: string
  /** The number as ten digits. '' when they wrote from an address. */
  number: string
  /** The name the line gives ("this is Kevin Alvarez"), else the name the contact carries (an email's From line). Null when neither. */
  name: string | null
  /** The company's own domain from the address; '' for an open mail service or a number. */
  domain: string
}

/**
 * The sender's facts from the row and the contact's channels. The row's `who` is the contact's name: a number, an
 * address, or the name an email's From line gave, which is the name when the line gives none.
 */
export function senderFacts(row: { who: string; body: string; channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }): SenderFacts {
  const email = row.channels?.find((ch) => ch.kind === 'email')?.value ?? row.who
  const phone = row.channels?.find((ch) => ch.kind === 'phone')?.value ?? row.who
  const address = normalizeChannel('email', email)
  const number = normalizeChannel('phone', phone)
  const who = row.who.trim()
  const whoIsAName = who !== '' && !who.includes('@') && !normalizeChannel('phone', who)
  return { address, number, name: nameInText(row.body) ?? (whoIsAName ? who : null), domain: companyDomain(address) }
}

const NOT_NAMES = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'The',
  'Just',
  'Not',
  'Still',
  'Here',
])

const NAME_WORD = "[A-Z][a-z]+(?:['’-][A-Za-z]+)?"
const SAYS_NAME = new RegExp(`(?:\\b[Tt]his is|\\b[Mm]y name is|\\bI am|\\bI'm|\\bI’m|\\b[Ii]t's|\\b[Ii]t’s|\\b[Ii]t is)\\s+(${NAME_WORD})(?:\\s+(${NAME_WORD}))?`)

/** The name a line gives for whoever wrote it: "this is Kevin Alvarez" is "Kevin Alvarez". Null when it gives none. */
export function nameInText(text: string): string | null {
  const m = SAYS_NAME.exec(text)
  if (!m?.[1] || NOT_NAMES.has(m[1])) return null
  return m[2] && !NOT_NAMES.has(m[2]) ? `${m[1]} ${m[2]}` : m[1]
}

const CANDIDATE: Omit<WhoGuess, 'name'> = {
  kind: 'candidate',
  label: 'A candidate, to the hiring board',
  words: 'The line moves to the hiring board and leaves Messages.',
  record: null,
  newPerson: false,
}

/** One of our own team (v2.5546): the press opens *Which of ours?*, the roster, in the card. */
const TEAM: Omit<WhoGuess, 'name'> = {
  kind: 'team',
  label: 'One of our own team',
  words: 'Pick them from the roster. The number goes on their People record, and the app can text them from now on.',
  record: null,
  newPerson: false,
}

const SOMEONE_ELSE: Omit<WhoGuess, 'name'> = {
  kind: 'someone_else',
  label: 'Someone else',
  words: 'Type who they are.',
  record: null,
  newPerson: false,
}

/** Trade partners whose own domain matches the sender's, those on an open ask first, each with a new person after it. */
function tradeGuesses(sender: SenderFacts, known: WhoKnown): WhoGuess[] {
  const { domain, name } = sender
  if (!domain) return []
  const matches = (known.trades ?? [])
    .filter((t) => t.emails.some((e) => companyDomain(e) === domain))
    .sort((a, b) => Number(Boolean(b.openAsk)) - Number(Boolean(a.openAsk)))
  return matches.flatMap((t): WhoGuess[] => {
    const record: GuessRecord = { table: 'gc_companies', id: t.id }
    const them: WhoGuess = {
      kind: 'trade',
      label: t.contactName ? `${t.contactName} at ${t.company}` : t.company,
      words: t.openAsk
        ? `The trade partner asked on ${t.openAsk}. This address goes on their record.`
        : 'A trade partner with this domain. This address goes on their record.',
      record,
      newPerson: false,
      name,
    }
    const someoneNew: WhoGuess = {
      kind: 'trade',
      label: name ? `${name} at ${t.company}` : `Someone new at ${t.company}`,
      words: 'A second person at the company.',
      record,
      newPerson: true,
      name,
    }
    return [them, someoneNew]
  })
}

/**
 * The guesses on *Who is this?*, in the box's order. First, on both boxes, **A customer we know** (`customerLink.ts`,
 * v2.5795): the customers the sender may be, each with why, since a general contractor writing to bids@ is a customer
 * too. The team line then: a new lead on Prospects, since someone texting for service is a lead until they book, then
 * **A new customer** as one live press. bids@: the new customer, then a trade partner whose domain matches, those on an
 * open ask first, then a new trade partner, then a supply house. Both end with a candidate, one of our own team and
 * someone else. No box reads as the team line. The contact's channels, when passed, give the address or the number
 * behind a name.
 */
export function whoGuesses(row: Pick<NewLaneRow, 'who' | 'body'> & { channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }, box: Mailbox | null, known: WhoKnown = {}): WhoGuess[] {
  const sender = senderFacts(row)
  const name = sender.name
  const end: WhoGuess[] = [
    { ...CANDIDATE, name },
    { ...TEAM, name },
    { ...SOMEONE_ELSE, name },
  ]
  const customers = customerMatches(sender, known)
  if (box === 'bids') {
    return [
      ...customers,
      newCustomerGuess(sender, box),
      ...tradeGuesses(sender, known),
      {
        kind: 'trade',
        label: name ? `${name}, a new trade partner` : 'A new trade partner',
        words: 'A company we have not asked.',
        record: null,
        newPerson: false,
        name,
      },
      {
        kind: 'supply_house',
        label: 'A supply house',
        words: 'Their lines stay off Follow up.',
        record: null,
        newPerson: false,
        name,
      },
      ...end,
    ]
  }
  return [
    ...customers,
    {
      kind: 'lead',
      label: name ? `${name}, a new lead on Prospects` : 'A new lead on Prospects',
      words: 'Prospects keeps the thread. They become a customer when they book.',
      record: null,
      newPerson: false,
      name,
    },
    newCustomerGuess(sender, box),
    ...end,
  ]
}

// ---------- Which job? ----------

/** A job as the sort card reads it. */
export interface LaneJob {
  id: string
  /** The number the app shows: "1312". */
  number: string
  name: string
  active: boolean
}

/** One job on the *Which job?* card. */
export interface JobChoice {
  id: string
  number: string
  name: string
  /** The job new lines land on, which took this one. It starts picked. */
  isDefault: boolean
}

/** Their active jobs in the rail's order, the default marked. */
export function jobChoices(row: Pick<NewLaneRow, 'jobIds' | 'defaultJobId'>, jobs: readonly LaneJob[]): JobChoice[] {
  const byId = new Map(jobs.map((j) => [j.id, j]))
  return row.jobIds.flatMap((id) => {
    const j = byId.get(id)
    return j?.active ? [{ id: j.id, number: j.number, name: j.name, isDefault: j.id === row.defaultJobId }] : []
  })
}

// ---------- Who has it? ----------

/** Someone who can take the conversation, and what they are: "the office", "the superintendent". */
export interface HasPerson {
  name: string
  words: string
  /** On the office team, offered right after the rule's pick. */
  office?: boolean
}

/** The has rule's pick and why: `{ name: 'Robert', why: 'Has Hillside on Boerne.' }`. */
export interface HasPick {
  name: string
  why: string
}

/** One person on the *Who has it?* card. */
export interface HasChoice {
  name: string
  words: string
  rulePick: boolean
}

/** The rule's pick first, then the office, then everyone else, each person once. */
export function hasChoices(_row: Pick<NewLaneRow, 'contactId'>, people: readonly HasPerson[], rule: HasPick | null): HasChoice[] {
  const out: HasChoice[] = []
  if (rule?.name.trim()) {
    const why = rule.why.trim()
    out.push({ name: rule.name, words: why ? `${why} The rule picks them.` : 'The rule picks them.', rulePick: true })
  }
  const taken = new Set(out.map((c) => c.name))
  const rest = [...people.filter((p) => p.office), ...people.filter((p) => !p.office)]
  for (const p of rest) {
    if (taken.has(p.name)) continue
    taken.add(p.name)
    out.push({ name: p.name, words: p.words, rulePick: false })
  }
  return out
}
