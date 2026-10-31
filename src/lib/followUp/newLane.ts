/**
 * Messages, residential R7: the New lane on Follow up, what came in and still needs sorting before anyone answers it.
 * Lifted from the customer Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-prototype.html`
 * v0.8, screen 7, mockup A: `SORT`, `needWord`, `sortCardHtml`) and `RESIDENTIAL_BUILD_PLAN.md` → R7.
 *
 * Three sorts, one row per person, the oldest waiting first:
 * - **Who is this?** A number or an address nobody has named. The guesses come in the box's order, both boxes opening
 *   with the customers the sender may be and why (`customerLink.ts`, v2.5795): the team line then offers a lead on
 *   Prospects, then a new customer as one live press; bids@ the new customer, then a trade partner whose domain matches
 *   one on an open ask, then a new trade partner, then a supply house. A candidate and someone else close both, and an
 *   email's card ends with **A notice, not a person** (punch list #223 PR 1, v2.6202): the address, and the company's
 *   whole domain when it is its own, marked so the thread goes done and the reader leaves the sender out from then on.
 * - **Which job?** Two or more active jobs, and their newest line sits on the default job because the default took it,
 *   not a person. A check, since the line is already on a job.
 * - **Who has it?** A new line from them that nobody has answered, and nobody on the conversation. The has rule's pick
 *   comes first, passed in.
 *
 * Pure. The box a line came in on (`mailbox`, R6) and whether a person tied it (`tiedByHand`, R7's `messages.tied_by`)
 * are inputs until their columns land; a line with no box reads as the team line. A text the app sent on its own
 * (`auto`, v2.6012: the text back after a missed call) is nobody's move: it never answers *Who has it?*, and the row
 * says the app texted back and still waits. The writes are the spine's `name_contact` and `tie_message` and cut 2's
 * `take_it`. `queue.ts` counts the lane on the badge later, through `newLaneCount`.
 */
import { firstName, normalizeChannel, type ChannelKind, type Contact, type ContactKind } from '../contacts/kernel'
import { customerMatches, newCustomerGuess, type KnownCustomer, type KnownPerson, type NamingJob, type NewCustomerMake } from './customerLink'
import { HIRE_ROSTER_KINDS } from '../prospects/hireRosterKinds'
import { snippetOf, whenWords, type MessageChannel, type ThreadMessage } from '../messages/thread'
import { textedBackLine } from '../quo/missedReply'
import { OPEN_MAIL_DOMAINS } from '../emailIn/leftOutSenders'

/** Which sort a row needs. */
export type NewSort = 'who' | 'job' | 'has'

/** The box a line came in on: the team line and inbox, or bids@ and its number (R6's `messages.mailbox`). */
export type Mailbox = 'team' | 'bids'

/** Each sort's head: the row's press and the sort card's region. The *Who is this?* card's own title is `whoHead`. */
export const SORT_HEADS: Readonly<Record<NewSort, string>> = { who: 'Who is this?', job: 'Which job?', has: 'Who has it?' }

/** The lane when nothing is waiting to be sorted. */
export const NEW_LANE_EMPTY = 'Nothing to sort. Every line that came in has a person, a job and someone on it.'

/** A person as the New lane reads them: the spine's contact, and who has the conversation (Follow up's `has`). */
export type NewLaneContact = Pick<Contact, 'id' | 'kind' | 'name' | 'company' | 'jobIds' | 'defaultJobId'> &
  Partial<Pick<Contact, 'goesBy'>> & {
    /** Who has it, by name. Null: nobody does. */
    has?: string | null
    /** Their numbers and addresses as given, for the row's words after the name (`reach`, v2.6191). Missing: the row shows none. */
    channels?: ReadonlyArray<{ kind: ChannelKind; value: string }>
  }

/** A line as the New lane reads it: the spine's message, the box it came in on and whether a person tied it. */
export type NewLaneMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'jobId' | 'channel' | 'direction' | 'at' | 'body'> &
  Partial<Pick<ThreadMessage, 'subject'>> & {
    /** The box it came in on. Null or missing: not known yet, read as the team line. */
    mailbox?: Mailbox | null
    /** True when a person tied it to its job. False when the default job took it as it came in. */
    tiedByHand?: boolean
    /** The app sent it on its own (`messages.auto`, v2.6012). Missing reads false. */
    auto?: boolean
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
  /**
   * The address or the number the line came from, for the row's words after the name (v2.6191): "dale@ridgeway.example",
   * "512-555-0142", the line's channel first (`rowReach`). '' when the name is that number or address already, or none is known.
   */
  reach: string
  /** Why it is in the lane, the sort card's first line. */
  why: string
  /** Their active jobs, in the rail's order. */
  jobIds: string[]
  /** The job new lines from them land on. Null: on the person. */
  defaultJobId: string | null
  /** The app texted back after their line (v2.6012): the quiet line under the row, "The app texted back at 4:12 PM. The row still waits on you." Null when it did not. */
  autoLine: string | null
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

/** Their newest line in, whether any line of ours went to them after it, and the newest text the app sent on its own. */
function newestLines(messages: readonly NewLaneMessage[]): Map<string, { lastIn: NewLaneMessage | null; lastOutAt: number; lastAutoAt: string | null }> {
  const by = new Map<string, { lastIn: NewLaneMessage | null; lastOutAt: number; lastAutoAt: string | null }>()
  for (const m of messages) {
    const cur = by.get(m.contactId) ?? { lastIn: null, lastOutAt: -Infinity, lastAutoAt: null }
    const at = Date.parse(m.at)
    if (m.direction === 'in' && (!cur.lastIn || at > Date.parse(cur.lastIn.at))) cur.lastIn = m
    if (m.direction === 'out' && m.auto) {
      if (!cur.lastAutoAt || at > Date.parse(cur.lastAutoAt)) cur.lastAutoAt = m.at
    } else if (m.direction === 'out' && at > cur.lastOutAt) cur.lastOutAt = at
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
      reach: rowReach({ who: c.name, channel: line.channel, channels: c.channels }),
      why,
      jobIds: active,
      defaultJobId: c.defaultJobId,
      autoLine: seen.lastAutoAt && Date.parse(seen.lastAutoAt) > Date.parse(line.at) ? textedBackLine(seen.lastAutoAt) : null,
    })
  }
  return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.who.localeCompare(b.who))
}

/** The New lane's count, for the Messages badge. */
export function newLaneCount(rows: readonly NewLaneRow[]): number {
  return rows.length
}

// ---------- Who is this? ----------

/** What a guess names the sender as. Supply house and candidate are R0's kinds; team (one of our own) is v2.5546's; notice (not a person) is v2.6202's. */
export type GuessKind = 'customer' | 'lead' | 'trade' | 'supply_house' | 'candidate' | 'team' | 'someone_else' | 'notice'

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
  /** A new trade partner, a supply house or a candidate (spike): the press makes the record from this, then names the contact as it. */
  makesRecord?: NewRecordMake
  /** A notice, not a person (v2.6202): the press marks this address, or everything from this domain, and closes the thread. */
  notice?: NoticeMark
}

/** What *A notice, not a person* marks: the address alone, or the company's whole domain. */
export interface NoticeMark {
  scope: 'address' | 'domain'
  /** The address, or the domain, as the button names it. */
  value: string
}

/** What a press that makes its own record is made from, carried on the guess and finished by the card's field. */
export interface NewRecordMake {
  /** The record the press makes: a trade partner, a supply house, or a candidate on the Team hiring board. */
  table: 'gc_companies' | 'supply_houses' | 'team_prospects'
  /** The field's label: Company, Supply house, Candidate. */
  field: string
  /** The field's starting words: the company as the address's domain spells it, or the sender's name. '' when nothing is known. */
  name: string
  /** The line under the field. */
  hint: string
  /** The press: Make the trade partner, Make the supply house, Put them on the hiring board. */
  press: string
  /** A trade partner only: the trade they do, which Trade partners' own door requires. '' until the card's pick. */
  trade?: string
}

/** A company's name as its domain spells it: "maxxbuilders.com" reads Maxxbuilders, "bexar-steel.example" Bexar Steel. '' for none. */
export function companyFromDomain(domain: string): string {
  const label = domain.trim().toLowerCase().split('.')[0] ?? ''
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
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

/** Mail services anyone can sign up for: a shared domain there says nothing about the company (`leftOutSenders.ts`, the one list). */
const OPEN_MAIL = OPEN_MAIL_DOMAINS

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

/** A number for a sentence: ten digits as 512-555-0142, since parentheses inside a sentence fail plain words. Anything else as it came. */
export function numberWords(raw: string): string {
  const ten = normalizeChannel('phone', raw)
  return ten.length === 10 ? `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}` : raw.trim()
}

/** The *Who is this?* card's head: who the question asks about (the owner's pattern, 2026-10-23). */
export interface WhoHead {
  /** The name we have for them, `senderFacts`' rule: the line's "this is …", else the From line's. '' when neither. */
  name: string
  /** The address, or the number as 512-555-0142. The channel the line came on first. '' when neither is known. */
  reach: string
  /** The question: "Who is Dale Ferris, dale@ridgeway.example?", "Who is 512-555-0142?". `SORT_HEADS.who` when nothing is known. */
  words: string
}

/**
 * The card's head for a sender nobody has named: the name first, then the address or the number after a comma, the
 * owner's pattern. A text from a number whose line says "this is Kevin Alvarez" reads *Who is Kevin Alvarez,
 * 210-555-0188?*; an email with a From line reads *Who is Dale Ferris, dale@ridgeway.example?*; a bare number reads
 * *Who is 512-555-0142?*. The row's pill and the thread header's button keep the short words, since the name sits
 * beside them. Pure; the sentence under it (`whoWhy`) names nothing the head says.
 */
export function whoHead(row: { who: string; body: string; channel?: MessageChannel; channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }): WhoHead {
  const name = senderFacts(row).name ?? ''
  const reach = reachWords(row)
  const words = name && reach ? `Who is ${name}, ${reach}?` : name || reach ? `Who is ${name || reach}?` : SORT_HEADS.who
  return { name, reach, words }
}

/**
 * The address, or the number as 512-555-0142, to reach the sender, as a sentence shows it: the channel of the line's
 * kind first, since a text's number is the one that wrote (the card's rule, v2.5798). The contact's channels, else the
 * row's `who` when it is one. '' when neither is known.
 */
export function reachWords(row: { who: string; channel?: MessageChannel; channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }): string {
  const email = row.channels?.find((ch) => ch.kind === 'email')?.value ?? row.who
  const phone = row.channels?.find((ch) => ch.kind === 'phone')?.value ?? row.who
  const address = normalizeChannel('email', email) ? email.trim() : ''
  const number = normalizeChannel('phone', phone) ? numberWords(phone) : ''
  return row.channel && PHONE_CHANNELS.has(row.channel) ? number || address : address || number
}

/**
 * The row's words after the name (v2.6191): the address or the number the line came from, `reachWords`' rule, for a
 * sender the row names. '' for a row named by its number or address, which would say it twice, and when none is known.
 */
export function rowReach(row: { who: string; channel: MessageChannel; channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }): string {
  const who = row.who.trim()
  if (who === '' || who.includes('@') || normalizeChannel('phone', who) !== '') return ''
  return reachWords(row)
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
  words: 'Puts them on the hiring board under Team. Their lines stay off Follow up.',
  record: null,
  newPerson: false,
}

/** A candidate, made by the press (spike): the Team hiring board's row from the sender's name, address and number. */
function candidateGuess(sender: SenderFacts): WhoGuess {
  const { name } = sender
  return {
    ...CANDIDATE,
    name,
    makesRecord: {
      table: 'team_prospects',
      field: 'Candidate',
      name: name ?? '',
      hint: name ? 'Their name, as the board will list it.' : 'Type their name.',
      press: 'Put them on the hiring board',
    },
  }
}

/** A new trade partner, made by the press (spike): the company as the address's domain spells it, the sender its contact. */
function newTradeGuess(sender: SenderFacts): WhoGuess {
  const { name, domain } = sender
  const company = companyFromDomain(domain)
  const first = name?.split(' ')[0] ?? ''
  return {
    kind: 'trade',
    label: name ? `${name}, a new trade partner` : 'A new trade partner',
    words: 'Makes the company under Trade partners, with this address. The thread stays with them.',
    record: null,
    newPerson: false,
    name,
    makesRecord: {
      table: 'gc_companies',
      field: 'Company',
      name: company,
      hint: company
        ? `Read from their address. Fix it if the company goes by another name.${first ? ` ${first} is its contact.` : ''}`
        : `Type the company’s name.${first ? ` ${first} is its contact.` : ''}`,
      press: 'Make the trade partner',
      trade: '',
    },
  }
}

/** A supply house, made by the press (spike): the house as the address's domain spells it, the sender a rep at it. */
function newSupplyHouseGuess(sender: SenderFacts): WhoGuess {
  const company = companyFromDomain(sender.domain)
  return {
    kind: 'supply_house',
    label: 'A supply house',
    words: 'Makes the house on Materials, with this address. Their lines stay off Follow up.',
    record: null,
    newPerson: false,
    name: sender.name,
    makesRecord: {
      table: 'supply_houses',
      field: 'Supply house',
      name: company,
      hint: company ? 'Read from their address. Fix it if the house goes by another name.' : 'Type the supply house’s name.',
      press: 'Make the supply house',
    },
  }
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

/** The block's head on the card, and the words under the two presses. */
export const NOTICE_BLOCK = 'A notice, not a person'

/**
 * *A notice, not a person* (punch list #223 PR 1, v2.6202), for a sender who wrote from an address: one press that marks
 * the address, *Mark news@alamosurety.example a notice*, and under it, when the address is on a company's own domain
 * and never an open mail service, *And everything from alamosurety.example*. Either closes the thread and leaves the
 * sender out from then on; search still finds the thread. Nothing for a number: a text is a person until Texts has its
 * own rule.
 */
export function noticeGuesses(sender: Pick<SenderFacts, 'address' | 'domain' | 'name'>): WhoGuess[] {
  if (!sender.address) return []
  const base = { kind: 'notice' as const, record: null, newPerson: false, name: sender.name }
  const out: WhoGuess[] = [
    { ...base, label: `Mark ${sender.address} a notice`, words: 'Closes the row and leaves this address out from now on. Search still finds the thread.', notice: { scope: 'address', value: sender.address } },
  ]
  if (sender.domain) {
    out.push({ ...base, label: `And everything from ${sender.domain}`, words: 'Every address at the company. Their next mail stays in Gmail with no label.', notice: { scope: 'domain', value: sender.domain } })
  }
  return out
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
 * someone else, and for an address the two notice presses (v2.6202). No box reads as the team line. The contact's channels, when passed, give the address or the number
 * behind a name.
 */
export function whoGuesses(row: Pick<NewLaneRow, 'who' | 'body'> & { channels?: ReadonlyArray<{ kind: ChannelKind; value: string }> }, box: Mailbox | null, known: WhoKnown = {}): WhoGuess[] {
  const sender = senderFacts(row)
  const name = sender.name
  const end: WhoGuess[] = [
    candidateGuess(sender),
    { ...TEAM, name },
    { ...SOMEONE_ELSE, name },
    ...noticeGuesses(sender),
  ]
  const customers = customerMatches(sender, known)
  if (box === 'bids') {
    return [...customers, newCustomerGuess(sender, box), ...tradeGuesses(sender, known), newTradeGuess(sender), newSupplyHouseGuess(sender), ...end]
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
