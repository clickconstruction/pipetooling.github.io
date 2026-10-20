/**
 * Messages, cut 3's screens: what the reply box sends. One interface, so the box's smoke hands it a fake; one
 * implementation on the app's client. Each send resolves to the thread line it wrote, so a later press (cut 2's *this
 * message gets it done*) can name it, and rejects with its refusal in words.
 *
 * - A note is cut 2's `add_note`, through Follow up's own io (`followUpIo.addNote`), so a note from the box and one from
 *   Follow up are the same write.
 * - An email goes through `messages-email`: Resend's existing send as the service role, the sent copy filed with the
 *   line as its source, and the line written in `messages` with its job and the address it went to. Its files (cut 7e)
 *   go as the function takes them (`documents/emailFileAsks.ts`), each kept on the line with how it went.
 * - A text goes through `quo-send` (cut 5), from the company number. While the texts switch is off the box never calls
 *   it (`useTextsOn`, Settings → Phone and texts → Send texts).
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabaseFollowUpIo, type FollowUpIo } from '../followUp/followUpIo'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailFileAsk } from '../documents/emailFileAsks'
import { BOXES_SETTINGS_KEY, parseBoxSettings, type BoxSettings } from './boxes'
import type { ComposeSender, EmailDraft } from './compose'
import type { DayKept } from './owed'
import { jobRefOf } from './load'
import { tieOf } from './replyBox'

/** The words a text says while Send texts is off: the reply box's Text tab draws them in place of the box, and the send window under a text. */
/**
 * The wait line while Send texts reads off (v2.5538, `TextsWaitLine.tsx` draws it): the words before the link, the
 * link's words (the switch's page, `TEXTS_WAIT_HREF`) and the words after; `TEXTS_WAIT` is the whole line as it reads
 * to the owner or a dev, who can flip the switch. Anyone else reads `TEXTS_WAIT_OTHERS`, which says who turns it on.
 */
export const TEXTS_WAIT_HREF = '/settings?tab=settings-phone-texts'
export const TEXTS_WAIT_PARTS = {
  before: 'Texts wait until Send texts is switched on. It is the first card on ',
  link: 'Settings → Phone and texts',
  after: '. Nothing else there is needed first. Send this as an email, or come back to it then.',
} as const
export const TEXTS_WAIT = `${TEXTS_WAIT_PARTS.before}${TEXTS_WAIT_PARTS.link}${TEXTS_WAIT_PARTS.after}`
export const TEXTS_WAIT_OTHERS = 'Texts wait until the owner or a dev switches on Send texts. Send this as an email, or come back to it then.'

/**
 * Whether the sends go from the two boxes (R6): `messages-email` sets the box's address as its Reply-To and `quo-send`
 * texts from the box's number (`sendBox`), each read from `messages_boxes_v1`. On since v2.5496, so the reply box names
 * the box their answer goes to and the number a text goes from. While Settings holds no address or number, the words
 * stay as before.
 */
export const SENDS_FROM_BOXES = true

/** The two boxes as Settings keeps them (`messages_boxes_v1`, R6's SQL). Null while the row is missing or empty. */
export async function loadBoxSettings(client: Pick<SupabaseClient, 'from'> = supabase): Promise<BoxSettings | null> {
  const result = await client.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
  checkSupabaseError(result, 'read the two boxes')
  return parseBoxSettings((result.data as { value_text: string | null } | null)?.value_text)
}

export interface ReplyEmail {
  contactId: string
  /** The address's `contact_channels` row. */
  channelId: string
  /** The job the line lands on, as the thread keys it, or null for on the person. */
  jobKey: string | null
  /** The words as the send window showed them (`compose.emailDraft`), the subject typed there included. */
  draft: Pick<EmailDraft, 'subject' | 'greeting' | 'body' | 'signature' | 'footer'>
  /** The files on it, each with how it goes (cut 7e). None: an email of words alone, as before. */
  files?: readonly EmailFileAsk[]
}

export interface ReplyText {
  contactId: string
  /** The number's `contact_channels` row. */
  channelId: string
  jobKey: string | null
  body: string
  /** The opt-out line held back this time (the quiet spell only). */
  held: boolean
}

export interface ReplyIo {
  /** The signed-in person as an email signs: their name, their title and their own cell. */
  loadSender(): Promise<ComposeSender>
  /** A team note, with its day to come back to Follow up when one is set (cut 2). Resolves to the note. */
  addNote(contactId: string, body: string, jobKey: string | null, back: DayKept | null): Promise<string>
  /** Resolves to the email's line. */
  sendEmail(input: ReplyEmail): Promise<string>
  /** Resolves to the text's line. */
  sendText(input: ReplyText): Promise<string>
}

/** An edge function's answer: the line it wrote, or its refusal in words. */
type Answer = { ok: true; messageId: string | null } | { ok: false; words?: string; error?: string }

async function invoke(name: string, body: Record<string, unknown>, doing: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<Answer>(name, { body })
  if (error) {
    // A refusal comes back as a non-2xx with its words in the body; anything else reads as the house says it.
    const context = (error as { context?: unknown }).context
    const answer = context instanceof Response ? ((await context.json().catch(() => null)) as Answer | null) : null
    if (answer && !answer.ok && (answer.words || answer.error)) throw new Error(answer.words ?? answer.error)
    checkSupabaseError({ data: null, error }, doing)
  }
  if (!data || !data.ok) throw new Error((data && !data.ok && (data.words ?? data.error)) || `Could not ${doing}.`)
  if (!data.messageId) throw new Error(`It went, but the thread did not keep its line. Read the thread again before you ${doing} again.`)
  return data.messageId
}

export function supabaseReplyIo(followUp: Pick<FollowUpIo, 'addNote'> = supabaseFollowUpIo()): ReplyIo {
  return {
    async loadSender() {
      const { data: auth } = await supabase.auth.getUser()
      const id = auth.user?.id
      if (!id) return { name: '' }
      // `users.title` arrives with cut 3's SQL (#5457) and joins the generated types with the lead's types PR; until it is
      // on the database the read goes without it, and the signature has no title.
      const db = supabase as unknown as SupabaseClient
      let read = await db.from('users').select('name, phone, title').eq('id', id).maybeSingle()
      if (read.error) read = await db.from('users').select('name, phone').eq('id', id).maybeSingle()
      checkSupabaseError(read, 'read your signature')
      const row = read.data as { name?: string | null; phone?: string | null; title?: string | null } | null
      return { name: row?.name?.trim() ?? '', title: row?.title ?? null, cell: row?.phone ?? null }
    },
    addNote: (contactId, body, jobKey, back) => followUp.addNote(contactId, body, jobRefOf(jobKey), back),
    sendEmail: (input) => {
      const { subject, greeting, body, signature, footer } = input.draft
      const files = input.files?.length ? { files: input.files } : {}
      return invoke(
        'messages-email',
        { contactId: input.contactId, channelId: input.channelId, tie: tieOf(input.jobKey), subject, greeting, body, signature, footer, ...files },
        'send the email',
      )
    },
    sendText: (input) =>
      invoke('quo-send', { contactId: input.contactId, channelId: input.channelId, tie: tieOf(input.jobKey), body: input.body, held: input.held }, 'send the text'),
  }
}
