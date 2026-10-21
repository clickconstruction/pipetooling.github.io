/**
 * The estimate door on our side of the thread (v2.5698, punch list #139 PR 7; the owner, 2026-10-20: "a button that
 * allows our side to open the estimate really easily and quickly"). Our estimate email's line carries the number in its
 * subject — *Estimate #166 — Estimate for Evan Johnson — $6,250 · Click Plumbing and Electrical*, a change order's
 * *Change order #80 — …* — and its words are the email's own heading, which is the subject again. The door reads the
 * number and names the press, and where the words only repeat the subject it draws in their place. Pure; the slot is
 * `components/estimates/useEstimateDoorThreadSlots.tsx`.
 */

export interface EstimateDoor {
  kind: 'estimate' | 'change-order'
  number: number
  /** The line's words only repeat the subject: the door draws in their place instead of under them. */
  duplicate: boolean
}

const SUBJECT_RE = /^\s*(estimate|change order)\s+#(\d+)\s*[—–-]/i

/** The door on one of our estimate emails; null on any other line. */
export function estimateDoorFor(m: { channel: string; direction: string; subject: string | null; body: string }): EstimateDoor | null {
  if (m.channel !== 'email' || m.direction !== 'out' || !m.subject) return null
  const hit = SUBJECT_RE.exec(m.subject)
  if (!hit) return null
  const number = Number(hit[2])
  if (!Number.isInteger(number) || number <= 0) return null
  const first = m.body.split('\n')[0]?.trim() ?? ''
  return { kind: hit[1]!.toLowerCase() === 'estimate' ? 'estimate' : 'change-order', number, duplicate: first === m.subject.trim() }
}

/** The estimate's page, change orders included. */
export const estimateDoorHref = (d: EstimateDoor) => `/estimates/${d.number}`

/** An estimate as the text door's read brings it: its number, its link's token hash, and whether it is a change order. */
export interface EstimateForDoor {
  number: number
  tokenHash: string
  changeOrder: boolean
}

/**
 * The door on a text (v2.5706, punch list #139 PR 14): a text carries the accept link's token, the estimate keeps the
 * token's hash (`acceptLinkTie.ts`), so a text whose token hashes to an estimate's opens that estimate. Texts with
 * no match, or whose link died (a resend re-mints the hash), draw none.
 */
export function textDoorsFrom(texts: ReadonlyArray<{ id: string; hashes: readonly string[] }>, estimates: readonly EstimateForDoor[]): Map<string, EstimateDoor> {
  const byHash = new Map(estimates.map((e) => [e.tokenHash.toLowerCase(), e]))
  const doors = new Map<string, EstimateDoor>()
  for (const t of texts) {
    for (const h of t.hashes) {
      const e = byHash.get(h.toLowerCase())
      if (e) {
        doors.set(t.id, { kind: e.changeOrder ? 'change-order' : 'estimate', number: e.number, duplicate: false })
        break
      }
    }
  }
  return doors
}

export const ESTIMATE_DOOR_WORDS = {
  open: (d: EstimateDoor) => `Open ${d.kind === 'estimate' ? 'estimate' : 'change order'} #${d.number}`,
  tip: 'Opens it on the Estimates page. The thread closes.',
}
