/**
 * GC mode, Owner Billing's O8b: Pay by card's words and its call, for `PortalCardBill.tsx` and its tests. The plan:
 * to-dos/gc-mode/mockups/owner-billing-o8.md → The customer's portal, on branch spike/gc-mode.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/** The panel's words (owner-billing-o8.md → The customer's portal), for the page and its tests. */
export const CARD_BILL_WORDS = {
  press: 'PAY BY CARD',
  hint: 'Card adds 3%',
  heading: 'Pay this bill by card',
  bill: (base: string) => `This bill is ${base}.`,
  fee: (fee: string) => `Paying by card adds a 3% card fee of ${fee}.`,
  total: (total: string) => `Your card pays ${total} in all.`,
  cardsOnly: 'After this, the bill takes cards only.',
  check: 'To pay by check with no fee, close this and mail your check.',
  go: 'Go to the card page',
  close: 'Close',
  onCard: (fee: string) => `Includes the ${fee} card fee.`,
  sample: 'This is a sample. On a real bill this opens the card page.',
  failed: 'We could not set up the card page. Call our office.',
  offline: 'Something went wrong. Please check your connection.',
} as const

/** A refusal that does not say whom to call gains the office's line. */
export function withOfficeLine(
  text: string,
  phone: string | null | undefined,
): string {
  if (/call our office/i.test(text)) return text
  const p = (phone ?? '').trim()
  return `${text} Call our office${p ? ` at ${p}` : ''}.`
}

/** Turn the bill to card: the card page's address, or the words to show. */
export async function openCardPage(
  token: string,
  invoiceId: string,
): Promise<{ ok: true; url: string } | { ok: false; text: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/gc-card-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, invoiceId }),
    })
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean
      url?: string
      words?: string
    } | null
    if (
      res.ok &&
      json?.ok &&
      typeof json.url === 'string' &&
      /^https:\/\//.test(json.url)
    )
      return { ok: true, url: json.url }
    return {
      ok: false,
      text: (json?.words ?? '').trim() || CARD_BILL_WORDS.failed,
    }
  } catch {
    return { ok: false, text: CARD_BILL_WORDS.offline }
  }
}
