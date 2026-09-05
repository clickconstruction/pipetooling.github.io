import type { ChangeOrderFormData } from './changeOrder'

/**
 * Bids → Estimates change-order bridge (CO train v2.1835), made to write after
 * confirm (journey-map J16-2, decision 17, 2026-09-05). "Send for signature →"
 * used to insert a $0 draft on one click with the typed cost impact stashed in
 * `internal_notes` — the one number that matters rode the least visible
 * channel. Now a confirm sheet shows the parsed fields and asks for the **net
 * change to the contract** as a number (prefilled from the free text when it
 * parses), and the draft is created with a real total and a real line.
 */

const MONEY_RE = /(-|−|\()?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?\s*(\))?/g
const NEGATIVE_WORDS = /\b(credit|deduct|deduction|decrease|reduce|reduction|remove|removed|less|savings?)\b/i

function tokenToCents(match: RegExpExecArray, lineNegative: boolean): number | null {
  const [, sign, whole, frac, close] = match
  const dollars = Number(`${whole!.replace(/,/g, '')}${frac ?? ''}`)
  if (!Number.isFinite(dollars)) return null
  const cents = Math.round(dollars * 100)
  const negative = sign === '-' || sign === '−' || (sign === '(' && close === ')') || lineNegative
  return negative ? -cents : cents
}

/**
 * Best-effort read of the "Impact on Cost" free text as a net change in
 * cents, or null when it can't be read with confidence:
 *
 * - a line mentioning "net" (or "total") with an amount → that amount;
 * - otherwise exactly one amount anywhere → that amount;
 * - otherwise (no amounts, or several with no "net" line) → null — the sheet
 *   asks the user instead of guessing.
 *
 * Sign: a leading "-"/"−", parentheses, or a credit-ish word on the same line
 * makes the amount negative. Bare small integers that look like counts
 * ("2 days", "3 fixtures") are not money unless prefixed with "$".
 */
export function parseCostImpact(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const found: { cents: number; net: boolean }[] = []
  for (const line of lines) {
    const lineNegative = NEGATIVE_WORDS.test(line)
    const net = /\b(net|total)\b/i.test(line)
    MONEY_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = MONEY_RE.exec(line)) !== null) {
      const raw = m[0]
      const hasDollar = raw.includes('$')
      const hasCentsOrGroup = Boolean(m[3]) || (m[2]?.includes(',') ?? false)
      if (!hasDollar && !hasCentsOrGroup) continue
      const cents = tokenToCents(m, lineNegative)
      if (cents === null) continue
      found.push({ cents, net })
    }
  }
  if (found.length === 0) return null
  const netHits = found.filter((f) => f.net)
  if (netHits.length === 1) return netHits[0]!.cents
  if (netHits.length > 1) return netHits[netHits.length - 1]!.cents
  if (found.length === 1) return found[0]!.cents
  return null
}

/** Keep only digits, one decimal point, and a leading minus while the user types a signed money amount. */
export function sanitizeSignedMoneyTyping(raw: string): string {
  const noComma = raw.replace(/,/g, '').replace(/−/g, '-').replace(/\$/g, '')
  let out = ''
  let dotSeen = false
  for (let i = 0; i < noComma.length; i++) {
    const c = noComma[i]!
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !dotSeen) {
      dotSeen = true
      out += '.'
    } else if (c === '-' && out === '') out = '-'
  }
  return out
}

/** Typed amount → cents; blank is 0 (schedule-only change orders are real); unreadable → null. */
export function signedMoneyToCents(raw: string): number | null {
  const t = sanitizeSignedMoneyTyping(raw)
  if (t === '' || t === '-' || t === '.' || t === '-.') return 0
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export function formatSignedDollars(cents: number): string {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return cents < 0 ? `−$${abs}` : `$${abs}`
}

export const BRIDGED_NET_CHANGE_LINE_LABEL = 'Net change to contract (from Bids change-order form)'

export type BridgedChangeOrderDraft = {
  total_cents: number
  line_items_snapshot: Array<{ line_item: string; description: string; quantity: number; unit_price_cents: number; amount_cents: number }>
  internal_notes: string
  change_order_fields: {
    description_of_change: string
    reason_for_change: string
    impact_on_schedule: string
    response_requested_by: string
  }
}

/**
 * The columns the bridge writes once the user confirms. A non-zero net change
 * becomes one real line (credits negative) so the money lives where the CO
 * editor reads it; the free-text breakdown still rides along as the line's
 * description and in the internal note, but it is no longer the only home.
 */
export function buildBridgedChangeOrderDraft(input: {
  form: Pick<ChangeOrderFormData, 'detailedDescriptionOfChange' | 'reasonForChange' | 'impactOnSchedule' | 'impactOnCost' | 'responseRequestDate' | 'submittedTo'>
  netChangeCents: number
}): BridgedChangeOrderDraft {
  const { form, netChangeCents } = input
  const costText = form.impactOnCost.trim()
  const notes = [
    'Created from Bids → Change Order.',
    costText ? `Cost impact (from the Bids form): ${costText}` : '',
    form.submittedTo.trim() ? `Bid submitted to: ${form.submittedTo.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return {
    total_cents: netChangeCents,
    line_items_snapshot:
      netChangeCents === 0
        ? []
        : [
            {
              line_item: BRIDGED_NET_CHANGE_LINE_LABEL,
              description: costText,
              quantity: 1,
              unit_price_cents: netChangeCents,
              amount_cents: netChangeCents,
            },
          ],
    internal_notes: notes,
    change_order_fields: {
      description_of_change: form.detailedDescriptionOfChange.trim(),
      reason_for_change: form.reasonForChange.trim(),
      impact_on_schedule: form.impactOnSchedule.trim(),
      response_requested_by: form.responseRequestDate.trim(),
    },
  }
}
