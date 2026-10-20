/**
 * May we text? (v2.5606, punch list #117). A cold prospect never agreed to texts, and the first
 * unasked text from the company number is the fastest way to a STOP. The office asks on the call
 * and sets the answer on the card; this is the one rule both the card and `quo-send` read: nothing
 * holds a text when they said yes, and words hold it when they said no or were never asked. Pure,
 * and imported by nothing else, so the edge copy carries it as it is.
 */
export type OkToTextRow = { ok_to_text: string | null; contact_name: string | null; company_name: string | null }

export type TextRefusal = { refused: 'noTexts' | 'notAskedToText'; words: string }

export function textRefusal(p: OkToTextRow | null | undefined): TextRefusal | null {
  if (!p) return null
  if (p.ok_to_text === 'yes') return null
  const who = (p.contact_name ?? '').trim() || (p.company_name ?? '').trim() || 'They'
  if (p.ok_to_text === 'no') return { refused: 'noTexts', words: `${who} said not to text them. Call or email instead.` }
  return { refused: 'notAskedToText', words: `${who} has not said we may text. Ask on the call, then set May we text? on their card.` }
}
