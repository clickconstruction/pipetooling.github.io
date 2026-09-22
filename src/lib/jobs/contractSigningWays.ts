/**
 * How this one gets signed (Signing it on paper PR 5, v2.3644). The sweep used to offer one
 * outcome — email a signing link — that prod says has never once produced a signature, with
 * paper as a workaround. The row already knows what it is, so the pane asks how this one gets
 * signed and pre-picks the answer: a homeowner row leads with **email the PDF to sign by hand**
 * (how every finished contract here was signed), a row with no email leads with **download to
 * print**, and a builder's row collapses to **file their subcontract** — ours is the wrong
 * document there — with our three ways demoted behind *Send ours anyway*. Pure.
 */
import type { ContractSweepRowState } from './contractSweepRowState'

export type SigningWay = 'pdf_email' | 'link' | 'download' | 'file_theirs'

export type SigningWayOption = {
  way: SigningWay
  label: string
  detail: string
  /** Why it cannot be picked, or null. */
  disabledReason: string | null
}

export type SigningWaysPlan = {
  /** The pre-picked way. */
  defaultWay: SigningWay
  /** The ways shown outright. */
  ways: SigningWayOption[]
  /** Ways kept one tap away (a builder's row: *Send ours anyway*). Empty otherwise. */
  demoted: SigningWayOption[]
}

const NEEDS_EMAIL = 'Needs a signer email — type one in To above'

function ourWays(emailOk: boolean): SigningWayOption[] {
  return [
    { way: 'pdf_email', label: 'Email the PDF to sign by hand', detail: 'We send it, they print and sign, we file it back — the signing link rides along as a second way', disabledReason: emailOk ? null : NEEDS_EMAIL },
    { way: 'link', label: 'Email a signing link', detail: 'They sign on screen, no printing', disabledReason: emailOk ? null : NEEDS_EMAIL },
    { way: 'download', label: 'Download to print', detail: 'For the counter or the mail — marks it handed over, so the job leaves this list', disabledReason: null },
  ]
}

export function signingWaysForRow(state: ContractSweepRowState | undefined, gcName: string | null): SigningWaysPlan {
  const emailOk = Boolean(state?.emailOk)
  if (state?.flags.includes('gc_job')) {
    return {
      defaultWay: 'file_theirs',
      ways: [{ way: 'file_theirs', label: `File ${gcName ? `${gcName}'s` : 'their'} subcontract`, detail: 'A builder sends us their paper — ours is the wrong document. Drop the file on the row, or pick it from Drive.', disabledReason: null }],
      demoted: ourWays(emailOk),
    }
  }
  return { defaultWay: emailOk ? 'pdf_email' : 'download', ways: ourWays(emailOk), demoted: [] }
}

/** The chosen way, falling back to the default when the pick is gone or cannot be used (the email was cleared). */
export function effectiveSigningWay(plan: SigningWaysPlan, picked: SigningWay | null | undefined): SigningWay {
  const all = [...plan.ways, ...plan.demoted]
  const hit = picked ? all.find((o) => o.way === picked) : null
  if (hit && !hit.disabledReason) return hit.way
  const def = all.find((o) => o.way === plan.defaultWay)
  if (def && !def.disabledReason) return def.way
  return all.find((o) => !o.disabledReason)?.way ?? plan.defaultWay
}

/**
 * The one line under the row of ways (v2.3706): what the chosen way does, and — when some of the
 * shown ways cannot be picked — which ones and why, so a dimmed segment never has to be hovered.
 */
export function signingWayDetailLine(plan: SigningWaysPlan, way: SigningWay): { detail: string; note: string | null } {
  const all = [...plan.ways, ...plan.demoted]
  const chosen = all.find((o) => o.way === way)
  const out = plan.ways.filter((o) => o.disabledReason)
  const reason = out[0]?.disabledReason ?? null
  const note = out.length > 0 && reason ? `${out.map((o) => o.label).join(' and ')}: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : null
  return { detail: chosen?.detail ?? '', note }
}

export type SigningWayButtons = {
  /** The one-job button. */
  label: string
  /** The fast path, or null when the way has none (filing opens a sheet). */
  andNextLabel: string | null
  busyLabel: string
}

export function signingWayButtons(way: SigningWay, hasNext: boolean): SigningWayButtons {
  switch (way) {
    case 'pdf_email':
      return { label: 'Email the PDF', andNextLabel: hasNext ? 'Email PDF & next' : null, busyLabel: 'Sending…' }
    case 'link':
      return { label: 'Send the link', andNextLabel: hasNext ? 'Send link & next' : null, busyLabel: 'Sending…' }
    case 'download':
      return { label: 'Download & mark handed over', andNextLabel: hasNext ? 'Download & next' : null, busyLabel: 'Building…' }
    default:
      return { label: 'File their subcontract', andNextLabel: null, busyLabel: 'Filing…' }
  }
}
