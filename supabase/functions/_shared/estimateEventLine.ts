/**
 * The thread's line for what a customer did with an estimate (v2.5705, punch list #139 PR 13, the third of the six
 * additions: "the thread is the whole timeline"). When they open the link, accept or decline, the estimate's Customer
 * activity knew and the thread did not. `insertEstimateCustomerEvent` writes the line this names into the customer's
 * own thread as one of the app's events, keyed so a repeat view or a repeat accept never writes twice.
 *
 * Deno-free on purpose: `src/lib/estimateEventLine.test.ts` imports this file directly (the `estimateLinkResend.ts`
 * pattern).
 */

export type EstimateEventForLine = 'public_link_view' | 'public_accept_submitted' | 'option_viewed' | 'declined'

export interface EstimateEventLine {
  /** The words, with the app's own mark first: "👀 Dana opened estimate #212." */
  body: string
  /** The `messages.quo_id` key: one line per estimate per kind. */
  key: string
}

const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || 'The customer'

/**
 * The line for an event, or null for one the thread does not draw (an option viewed, an accept the page repeated
 * after the row was already accepted). A signature on the accept is said.
 */
export function estimateEventLine(
  eventType: EstimateEventForLine,
  input: { estimateId: string; estimateNumber: number | null; customerName: string | null; metadata?: Record<string, unknown> | null },
): EstimateEventLine | null {
  const who = first(input.customerName)
  const num = input.estimateNumber ? `#${input.estimateNumber}` : 'the estimate'
  const what = input.estimateNumber ? `estimate ${num}` : num
  if (eventType === 'public_link_view') return { body: `👀 ${who} opened ${what}.`, key: `estimate:${input.estimateId}:opened` }
  if (eventType === 'public_accept_submitted') {
    if (input.metadata?.repeat_after_accepted === true) return null
    const signed = input.metadata?.had_signature === true ? ' Signed.' : ''
    return { body: `✍️ ${who} accepted ${what}.${signed}`, key: `estimate:${input.estimateId}:accepted` }
  }
  if (eventType === 'declined') return { body: `🚫 ${who} declined ${what}.`, key: `estimate:${input.estimateId}:declined` }
  return null
}
