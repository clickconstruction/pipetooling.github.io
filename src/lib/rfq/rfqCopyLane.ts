/**
 * Copy-with-quote-link lane (RFQ lane A) as a tiny state machine — the order
 * of operations is the whole point (journey-map J12-N1, decision 17,
 * 2026-09-05): the `bid_rfqs` row is inserted ONLY after the link is in the
 * user's hands. Before this the row was inserted first and a failed clipboard
 * write ("Document is not focused", denied permission) left an orphan `sent`
 * request with no chip and no `onRfqMinted`; a retry minted a duplicate.
 *
 *   idle ──prepare──▶ prepared ──clipboard_ok──▶ copied ──insert_ok──▶ minted
 *                        │                          ▲   └─insert_failed─┐ (stay; retry reuses the token)
 *                        └─clipboard_failed─▶ copy_failed ─confirm_copied┘
 *                                                  └─cancel─▶ idle (nothing written)
 *
 * Pure: the component owns the token/text; this decides what is allowed next.
 */
export type RfqCopyLaneState = 'idle' | 'prepared' | 'copied' | 'copy_failed' | 'minted'

export type RfqCopyLaneEvent =
  | 'prepare'
  | 'clipboard_ok'
  | 'clipboard_failed'
  | 'confirm_copied'
  | 'insert_ok'
  | 'insert_failed'
  | 'cancel'

const TRANSITIONS: Record<RfqCopyLaneState, Partial<Record<RfqCopyLaneEvent, RfqCopyLaneState>>> = {
  idle: { prepare: 'prepared' },
  prepared: { clipboard_ok: 'copied', clipboard_failed: 'copy_failed', cancel: 'idle' },
  copy_failed: { confirm_copied: 'copied', cancel: 'idle' },
  copied: { insert_ok: 'minted', insert_failed: 'copied', cancel: 'idle' },
  minted: {},
}

/** Next state, or the same state when the event is not legal there (illegal events are ignored, never throw). */
export function rfqCopyLaneNext(state: RfqCopyLaneState, event: RfqCopyLaneEvent): RfqCopyLaneState {
  return TRANSITIONS[state][event] ?? state
}

/** The single state in which the `bid_rfqs` INSERT is allowed. */
export function rfqCopyLaneMayInsert(state: RfqCopyLaneState): boolean {
  return state === 'copied'
}

/** Public quote page for a token — the line appended to the paste and shown in the manual-copy fallback. */
export function quoteLinkUrl(token: string): string {
  return `https://clicktooling.com/q/${token}`
}

/** The exact paste: the scoped list, a blank line, then the "Price it here" link. */
export function buildQuoteLinkPaste(copyText: string, token: string): string {
  return `${copyText}\n\nPrice it here: ${quoteLinkUrl(token)}`
}

/** Replays a sequence of events from idle — handy for asserting whole paths. */
export function rfqCopyLaneRun(events: readonly RfqCopyLaneEvent[]): RfqCopyLaneState {
  return events.reduce<RfqCopyLaneState>((s, e) => rfqCopyLaneNext(s, e), 'idle')
}
