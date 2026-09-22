import type { RunNotice, RunRecipient, RunSendMethod } from './lienDeskRun'

/**
 * The run's envelopes (v2.3720, punch list #16): what the post office sees.
 * Every notice has two statutory recipients, but two notices to one name at
 * one address — two jobs at the same property, or every notice's copy for
 * the one original contractor — go in one envelope with one tracking
 * number. The notices stay the unit of record (`job_lien_filings`, one per
 * job); the envelope is the unit of mailing, and the modal keeps every
 * recipient inside it on the same method and tracking.
 */

/** One party at one address. Case, punctuation and spacing do not make a second envelope; a missing name or address never merges. */
export function envelopeKey(name: string, address: string): string {
  // Punctuation goes without leaving a gap ("L.L.C." is "LLC"); runs of whitespace become one space.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]+/g, '').replace(/\s+/g, ' ').trim()
  const n = norm(name)
  const a = norm(address)
  return n && a ? `${n}|${a}` : ''
}

export type RunEnvelopeContent = { notice: RunNotice; recipient: RunRecipient; noticeIndex: number; recipientIndex: number }

export type RunEnvelope = {
  key: string
  /** 1-based, in order of first appearance — the cover sheet's number. */
  n: number
  /** The first recipient's label — 'Owner of record' or 'Original contractor'. */
  label: string
  name: string
  address: string
  /** The first email on file among the recipients inside. */
  email: string
  method: RunSendMethod
  tracking: string
  contents: RunEnvelopeContent[]
}

/** The envelopes in order of first appearance, each with the notices inside it. */
export function runEnvelopes(notices: ReadonlyArray<RunNotice>): RunEnvelope[] {
  const out: RunEnvelope[] = []
  const byKey = new Map<string, RunEnvelope>()
  notices.forEach((notice, noticeIndex) => {
    notice.recipients.forEach((recipient, recipientIndex) => {
      const key = envelopeKey(recipient.name, recipient.address) || `${notice.itemId}:${recipient.key}`
      let env = byKey.get(key)
      if (!env) {
        env = { key, n: out.length + 1, label: recipient.label, name: recipient.name, address: recipient.address, email: recipient.email, method: recipient.method, tracking: recipient.tracking, contents: [] }
        byKey.set(key, env)
        out.push(env)
      }
      if (!env.email && recipient.email) env.email = recipient.email
      env.contents.push({ notice, recipient, noticeIndex, recipientIndex })
    })
  })
  return out
}

/** The recipient-count the envelopes replaced — how many the run would have mailed one per copy. */
export function runCopies(notices: ReadonlyArray<RunNotice>): number {
  return notices.reduce((s, n) => s + n.recipients.length, 0)
}
