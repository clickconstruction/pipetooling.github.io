/**
 * Messages, residential R6 (two boxes, two numbers, one inbox): the office answers the plumbing company's customers
 * from the team box and the GC side's trades from bids@, each with its own number, and reads both in one inbox. This
 * says which box a kind of contact is for, which box a reply and a new conversation go from, the from line, which box
 * a line came in on, and what a STOP to one number writes. Lifted from the customer messages prototype (branch
 * spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-prototype.html` v0.8) and `RESIDENTIAL_BUILD_PLAN.md` → R6
 * and section 7, decision 5. Pure: the addresses and the numbers are Settings', never written here.
 *
 * `compose.ts` still sends from one company mailbox and number (`ComposeCompany`) until R6's compose PR reads these.
 */
import { normalizeChannel } from '../contacts/kernel'

/** The box a line came in on or goes out from. The same union as `followUp/newLane.ts`'s, which imports it once both land. */
export type Mailbox = 'team' | 'bids'

export const MAILBOXES: readonly Mailbox[] = ['team', 'bids']

/** The `app_settings` key that holds both boxes (R6's SQL), JSON `{ team, bids }` of `BoxSetting`. */
export const BOXES_SETTINGS_KEY = 'messages_boxes_v1'

/** One box as Settings keeps it. */
export interface BoxSetting {
  /** Its email address. */
  address: string
  /** Its number, as people read it: "(512) 555-0144". */
  phone: string
  /** Its number's Quo id (`PN…`), every text's From. */
  numberId: string
}

export type BoxSettings = Readonly<Record<Mailbox, BoxSetting>>

/**
 * Who each box is for, by the contact's kind. The team box holds the plumbing company's own people and bids@ the GC
 * side's. An unknown sender has no box of its kind: a reply goes from the box they wrote to, and a conversation we start
 * goes from the team box.
 */
export const BOXES: Readonly<Record<Mailbox, { kinds: readonly string[] }>> = {
  // The owner's open call, section 7 decision 5: team@ or office@. office@ is on the letterhead, the lien reply-to and
  // the website terms today. Whichever is chosen goes everywhere, and only the address in Settings changes.
  team: { kinds: ['customer', 'lead', 'sub', 'candidate'] },
  bids: { kinds: ['trade', 'arch', 'supply_house'] },
}

/** The box a kind of contact is for. Null for an unknown sender, or a kind no box holds. */
export function boxForKind(kind: string): Mailbox | null {
  return MAILBOXES.find((box) => BOXES[box].kinds.includes(kind)) ?? null
}

/** The box a conversation we start goes from: the kind's box, else the team box. */
export function boxForNew(contact: { kind: string }): Mailbox {
  return boxForKind(contact.kind) ?? 'team'
}

/**
 * The box a reply goes from: the one the person last wrote to, whatever their kind, so a GC customer who wrote to bids@
 * hears back from bids@. When we do not know where they wrote, the kind's box.
 */
export function boxForReply(wroteTo: Mailbox | null, contact: { kind: string }): Mailbox {
  return wroteTo ?? boxForNew(contact)
}

/** A number in words, its area code out of parentheses so the line passes plain words: "(512) 555-0144" is "512-555-0144". */
export function phoneWords(phone: string): string {
  return phone.trim().replace(/^\((\d{3})\)\s*/, '$1-')
}

/** The from line in the empty box, one piece each: "from team@…", "Click Plumbing". */
export function fromWords(box: Mailbox, channel: 'text' | 'email', settings: BoxSettings, companyName: string): string[] {
  const s = settings[box]
  if (channel === 'email') return [`from ${s.address}`, companyName]
  return [`from ${box === 'team' ? 'the company number' : 'the bids number'} ${phoneWords(s.phone)}`, companyName]
}

/** What the reader knows of where a line came in: R6's `messages.mailbox`, the Quo number id it came to, the address it was sent to. */
export interface InboundTo {
  mailbox?: Mailbox | null
  /** Quo's `to` on a text or a call in: our number's id. */
  toNumberId?: string | null
  /** The email's To: "bids@clickconstruction.example" or "Click Bids <bids@…>". */
  toAddress?: string | null
}

const bareAddress = (raw: string) => normalizeChannel('email', /<([^>]+)>/.exec(raw)?.[1] ?? raw)

/** The box a line came in on: its `mailbox` once R6's SQL fills it, else the number it came to, else the address. Null: not known. */
export function boxOfInbound(line: InboundTo, settings: BoxSettings): Mailbox | null {
  if (line.mailbox) return line.mailbox
  const id = line.toNumberId?.trim()
  if (id) {
    const box = MAILBOXES.find((b) => settings[b].numberId === id)
    if (box) return box
  }
  const to = line.toAddress?.trim()
  if (to) {
    const address = bareAddress(to)
    const box = MAILBOXES.find((b) => bareAddress(settings[b].address) === address)
    if (box) return box
  }
  return null
}

/**
 * A STOP or a START per our number, as R6's `contact_channels.opted_out_by_box` keeps it: the box and when they stopped,
 * null after a START. A box with no entry reads the channel's older `opted_out_at`, which stops every box.
 */
export type OptedOutByBox = Partial<Record<Mailbox, string | null>>

/** One number of theirs as the STOP reads it. */
export interface StopChannel {
  channelId: string
  /** The older stamp from before two numbers: a STOP to every one of ours. */
  optedOutAt: string | null
  optedOutByBox?: OptedOutByBox | null
}

/** Whether our number in `box` may text this number of theirs. */
export function stoppedOn(channel: StopChannel, box: Mailbox): boolean {
  const byBox = channel.optedOutByBox ?? {}
  return box in byBox ? byBox[box] != null : channel.optedOutAt != null
}

/** What a STOP or a START writes on `contact_channels`: the channel and its whole `opted_out_by_box`. */
export interface StopWrite {
  channelId: string
  /** The boxes the word reached. */
  boxes: Mailbox[]
  optedOutByBox: OptedOutByBox
}

/**
 * A STOP to one of our numbers silences that number for this person and never the other, as carriers scope it to the
 * pair. A START reopens the one it came to. A word to a number we cannot place reaches both, so a STOP is never missed.
 */
export function stopScope(channel: StopChannel, word: 'stop' | 'start', to: Mailbox | null, at: string): StopWrite {
  const boxes = to ? [to] : [...MAILBOXES]
  const next: OptedOutByBox = { ...(channel.optedOutByBox ?? {}) }
  for (const box of boxes) next[box] = word === 'stop' ? at : null
  return { channelId: channel.channelId, boxes, optedOutByBox: next }
}
