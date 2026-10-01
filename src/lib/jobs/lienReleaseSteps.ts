/**
 * The Release of Lien window as six steps (v2.4314) — which step is done, which is the one to do
 * now, which needs a fix, and which waits. Pure: the window passes what it already knows and draws
 * the rail from the answer. Grace's ask (2026-10-01): the left side broken into numbered steps
 * with arrows, so an assistant can follow it top to bottom. Canvas 7j4cpdy7PdVAbjgTvpS7mN.
 *
 *   1 Pick the bills · 2 Check the form · 3 Check the amount · 4 Check the details ·
 *   5 Get it signed · 6 Send it to the GC
 *
 * Rules:
 * - Steps 2 to 4 are done as soon as the bills are picked, because the app fills them — unless
 *   the amount is empty (step 3 is then the one to do), the unconditional final is early (step 3
 *   needs a fix), or a detail the page prints is blank (step 4 needs a fix).
 * - A step with a problem holds everything after it: those steps wait, labelled "Waits for step N" —
 *   folded to their titles when the problem is in step 1, greyed in place when it is further down.
 * - Step 5 is the one to do once nothing above needs anything; step 6 opens when he has signed.
 * - Once a signature is requested, steps 1 to 4 fold to one line each; once signed, 1 to 5 do.
 */

export type ReleaseStepKey = 'bills' | 'form' | 'amount' | 'details' | 'signed' | 'send'
export type ReleaseStepState = 'done' | 'now' | 'warn' | 'wait'

export type ReleaseStep = {
  n: number
  key: ReleaseStepKey
  state: ReleaseStepState
  /** A wait caused by an earlier step's problem: the step number to fix first. Null for an ordinary wait. */
  waitsFor: number | null
  /** Shown as one line: the work has moved past it (a signature requested, or signed). */
  folded: boolean
}

export type ReleaseStepsInput = {
  /** Bills on the job the waiver can cover; 0 means it covers the whole job and there is nothing to pick. */
  billCount: number
  billsPicked: number
  /** A live waiver already covers a picked bill, and nobody chose to make this one anyway. */
  covered: boolean
  /** The Amount box as a number. */
  amount: number
  /** An unconditional final while money is still owed, and nobody chose to go on anyway. */
  tooEarly: boolean
  /** Details the page prints that are blank or half typed. */
  detailsMissing: number
  rowStatus: 'draft' | 'issued' | 'awaiting_signature' | 'signed' | null
  sent: boolean
}

export type ReleaseSteps = { steps: ReleaseStep[]; current: ReleaseStep | null }

const KEYS: ReleaseStepKey[] = ['bills', 'form', 'amount', 'details', 'signed', 'send']

export function lienReleaseSteps(i: ReleaseStepsInput): ReleaseSteps {
  const signed = i.rowStatus === 'signed'
  const asked = i.rowStatus === 'awaiting_signature'
  const locked = signed || asked
  const state: ReleaseStepState[] = new Array(6).fill('wait')

  // 1 · Pick the bills
  state[0] = locked || i.billCount === 0 ? 'done' : i.billsPicked === 0 ? 'now' : i.covered ? 'warn' : 'done'
  const billsOk = state[0] === 'done'
  // 2 · Check the form — the app picks it from the bills.
  state[1] = billsOk ? 'done' : 'wait'
  // 3 · Check the amount
  state[2] = locked ? 'done' : !billsOk ? 'wait' : !(i.amount > 0) ? 'now' : i.tooEarly ? 'warn' : 'done'
  // 4 · Check the details
  state[3] = locked ? 'done' : !billsOk ? 'wait' : i.detailsMissing > 0 ? 'warn' : 'done'

  const blocking = state.slice(0, 4).findIndex((s) => s === 'now' || s === 'warn')
  // 5 · Get it signed
  state[4] = signed ? 'done' : blocking >= 0 ? 'wait' : 'now'
  // 6 · Send it
  state[5] = i.sent ? 'done' : signed ? 'now' : 'wait'

  const steps: ReleaseStep[] = KEYS.map((key, idx) => {
    const s = state[idx]!
    let waitsFor: number | null = null
    if (s === 'wait' && blocking >= 0 && blocking < idx) waitsFor = blocking + 1
    return { n: idx + 1, key, state: s, waitsFor, folded: signed ? idx <= 4 : asked ? idx <= 3 : false }
  })
  return { steps, current: steps.find((s) => s.state === 'now' || s.state === 'warn') ?? null }
}
