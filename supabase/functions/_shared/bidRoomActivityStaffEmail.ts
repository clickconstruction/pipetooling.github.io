/**
 * The staff notice sign-bid-room sends when a GC does something in a bid room (opened the
 * room, signed, declined) — dependency-free so Settings → What the team sees renders it on
 * sample data (punch list #60, v2.4142). Moved verbatim from the function: one line of text,
 * the HTML is that text with line breaks.
 */
export type BidRoomActivityStaffEmailInput = {
  /** The proposal's project name; empty falls back to "A proposal". */
  projectName: string | null
  /** What the GC did, in the room's words — "signed the proposal", "opened the room". */
  what: string
  origin: string
}

export function bidRoomActivityStaffEmail(input: BidRoomActivityStaffEmailInput): { subject: string; text: string; html: string } {
  const subject = `Bid room — ${input.projectName || 'proposal'}`
  const text = `${input.projectName || 'A proposal'}: the GC ${input.what}\n\nOpen ClickTooling: ${input.origin}/bids\n`
  return { subject, text, html: text.replace(/\n/g, '<br>') }
}
