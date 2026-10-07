/**
 * The throttle on wrong keys to the law firm's portal (v2.4756). The address is short on purpose
 * — the owner's call: my.clickplumbing.com/snell-law-f6a, three characters of key after a name
 * the office picks — so the portal functions count wrong keys by caller and refuse a caller with
 * ten misses in an hour. A right key is never refused: the gate slows a guesser, it cannot lock
 * the firm out. `legal_portal_guess_gate(ip, miss)` (service role) keeps the count.
 *
 * Shared by legal-portal (the page's load and the /p/ probe) and submit-legal-portal (the firm's
 * acts). Both ask the gate before they look the key up, and tell it after a miss.
 */

export const GUESS_LOCKED_MSG = 'Too many wrong links from this connection. Wait an hour, or contact the office for the right one.'

/** The gate's answer; `locked` false when the RPC is not live yet, so the portal never closes on a missing throttle. */
export type GuessGate = { locked: boolean; misses: number }

// deno-lint-ignore no-explicit-any
export async function askGuessGate(admin: any, ip: string | null, miss: boolean): Promise<GuessGate> {
  try {
    const { data, error } = await admin.rpc('legal_portal_guess_gate', { p_ip: ip ?? 'unknown', p_miss: miss })
    if (error) return { locked: false, misses: 0 }
    const d = (data ?? {}) as { locked?: unknown; misses?: unknown }
    return { locked: d.locked === true, misses: typeof d.misses === 'number' ? d.misses : 0 }
  } catch {
    return { locked: false, misses: 0 }
  }
}
