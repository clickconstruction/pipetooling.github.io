/**
 * Preview on the Tell the customer sheet (v2.5794): what the customer will see, in a window over the sheet with the
 * sheet still open under it. The email is the page's own built message, from the same builder that sends it, handed
 * in by the page; the text is the box's words with the link filled by a sample, since the real link is minted when
 * the email goes. Pure; the window is `components/customers/TellCustomerPreview.tsx`.
 */
import { fillLine } from '../quickReplies/blanks'

export type PreviewKind = 'email' | 'text'

/** The email as the page built it for its own preview (`buildEstimateLetterheadEmail`): the message that sends. */
export interface PreviewEmail {
  from: string
  replyTo: string | null
  subject: string
  html: string
}

/** A sample accept link in the real one's shape. It opens nothing, and the window says so. */
export const SAMPLE_ACCEPT_LINK = 'https://clicktooling.com/estimate/accept?t=sample'

export interface TextPreview {
  /** The words as they would land, the link filled by the sample. */
  words: string
  /** True when the words held `{link}`, so the note about the sample shows. */
  sample: boolean
  /** Blanks still in braces, which hold the send; the preview shows them as they are. */
  left: readonly string[]
}

export function textPreview(words: string, sampleLink: string = SAMPLE_ACCEPT_LINK): TextPreview {
  const trimmed = words.trim()
  const filled = fillLine(trimmed, { link: sampleLink })
  return { words: filled.text, sample: /\{link\}/.test(trimmed), left: filled.left }
}

/** The kinds the window can show: the email only when the page handed one in, the text only when one goes. */
export function previewKinds(has: { email: boolean; text: boolean }): PreviewKind[] {
  const out: PreviewKind[] = []
  if (has.email) out.push('email')
  if (has.text) out.push('text')
  return out
}

export interface WordsPart {
  text: string
  link: boolean
}

/** A text's words split at its links, so the window draws each link as the phone would. */
export function splitLinks(words: string): WordsPart[] {
  const out: WordsPart[] = []
  const re = /https?:\/\/[^\s]+/g
  let at = 0
  for (const m of words.matchAll(re)) {
    const start = m.index ?? 0
    if (start > at) out.push({ text: words.slice(at, start), link: false })
    out.push({ text: m[0], link: true })
    at = start + m[0].length
  }
  if (at < words.length) out.push({ text: words.slice(at), link: false })
  return out
}

export const PREVIEW_WORDS = {
  press: 'Preview',
  pressTip: (kind: PreviewKind) => (kind === 'email' ? 'See the email as it arrives.' : 'See the text as it lands on their phone.'),
  title: (first: string | null) => `What ${first ?? 'the customer'} sees`,
  pill: (kind: PreviewKind) => (kind === 'email' ? 'The email' : 'The text'),
  stays: 'The sheet stays open under this. Nothing is sent from here.',
  from: 'From',
  replyTo: 'Reply to',
  to: 'To',
  subject: 'Subject',
  frameTitle: 'The email as it arrives',
  /** A label over the bubble, not a sentence: the number as the app formats it. */
  textTo: (number: string) => `To ${number}`,
  textFrom: 'From the company number.',
  sampleLink: 'The link here is a sample. The real one fills in when the email goes.',
  back: 'Back to the sheet',
} as const
