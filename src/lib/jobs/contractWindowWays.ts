/**
 * The Contract window's one question (v2.4154): how does this one get signed? Three ways in a
 * rail — send a link, sign here now, on paper — plus a builder's job leading with *File their
 * subcontract*, the way the Contract sweep does. The window opens with the answer made from what
 * the job knows (an email → a link; a mobile only → the link by text; neither → paper), one
 * button whose label follows the pick, and a sentence that says what will happen. Pure; the
 * window does the I/O. The sweep keeps its own plan in `contractSigningWays.ts` — its default is
 * the PDF to sign by hand, because that is what has produced signatures in the backlog.
 */

export type WindowWay = 'link' | 'here' | 'paper' | 'file_theirs'
/** On paper, how the page reaches them. */
export type PaperSend = 'download' | 'pdf_email'

export type WindowWayOption = {
  way: WindowWay
  label: string
  detail: string
  /** Why it cannot be picked right now, or null. */
  disabledReason: string | null
}

export type WindowWaysPlan = {
  defaultWay: WindowWay
  ways: WindowWayOption[]
  /** A builder's job: our three ways, one tap behind *Send ours anyway*. Empty otherwise. */
  demoted: WindowWayOption[]
}

export type WindowWaysInput = {
  /** A usable signer email is on the job or typed. */
  emailOk: boolean
  /** A mobile number is on the job or typed. */
  phoneOk: boolean
  /** The customer is a builder — their subcontract is the agreement. */
  gcJob: boolean
  gcName?: string | null
}

export const LINK_NEEDS = 'Needs an email or a mobile — add one, or pick another way'

function ourWays(input: WindowWaysInput): WindowWayOption[] {
  const canLink = input.emailOk || input.phoneOk
  return [
    { way: 'link', label: 'Send a link', detail: 'They review and sign on their phone. Email, text, or both.', disabledReason: canLink ? null : LINK_NEEDS },
    { way: 'here', label: 'Sign here, now', detail: 'They sign on this device. Nothing is emailed until they do.', disabledReason: null },
    { way: 'paper', label: 'On paper', detail: 'Print for a pen, or email the PDF. The job leaves the count when it is handed over.', disabledReason: null },
  ]
}

export function windowWaysPlan(input: WindowWaysInput): WindowWaysPlan {
  if (input.gcJob) {
    return {
      defaultWay: 'file_theirs',
      ways: [{ way: 'file_theirs', label: `File ${input.gcName ? `${input.gcName}'s` : 'their'} subcontract`, detail: 'A builder sends us their paper — ours is the wrong document.', disabledReason: null }],
      demoted: ourWays(input),
    }
  }
  return { defaultWay: input.emailOk || input.phoneOk ? 'link' : 'paper', ways: ourWays(input), demoted: [] }
}

/** The chosen way, falling back to the default when the pick is gone or cannot be used (the email was cleared). */
export function effectiveWindowWay(plan: WindowWaysPlan, picked: WindowWay | null | undefined): WindowWay {
  const all = [...plan.ways, ...plan.demoted]
  const hit = picked ? all.find((o) => o.way === picked) : null
  if (hit && !hit.disabledReason) return hit.way
  const def = all.find((o) => o.way === plan.defaultWay)
  if (def && !def.disabledReason) return def.way
  return all.find((o) => !o.disabledReason)?.way ?? plan.defaultWay
}

export type WindowSentenceInput = {
  way: WindowWay
  paperSend: PaperSend
  recipientName: string
  email: string
  phone: string
  /** The link also goes by text (the Send a link pane's checkbox). */
  textToo: boolean
  remindersEnabled: boolean
  fromAddress: string
}

/** The sentence under the button: what pressing it does, to whom, with what reminders. */
export function windowWaySentence(i: WindowSentenceInput): string {
  const who = i.recipientName.trim() || 'the customer'
  const email = i.email.trim()
  const phone = i.phone.trim()
  const reminders = i.remindersEnabled ? ' Reminders every 3 days until signed, up to 3.' : ' No reminders.'
  switch (i.way) {
    case 'link': {
      if (email && i.textToo && phone) return `Emails ${email} a Review & sign link from ${i.fromAddress} and opens a text to ${phone} with the same link.${reminders}`
      if (email) return `Emails ${email} a Review & sign link from ${i.fromAddress}.${reminders}`
      if (phone) return `Opens a text to ${phone} with the Review & sign link. Add an email for reminders and their signed copy.`
      return 'Add an email or a mobile to send a link.'
    }
    case 'here':
      return `Opens the signing page on this device for ${who} to read and sign.${email ? ` Their signed copy goes to ${email}.` : ' Add an email if they want a signed copy sent.'}`
    case 'paper':
      return i.paperSend === 'pdf_email'
        ? email
          ? `Emails ${email} the agreement as a PDF to print, sign and send back, with the signing link as a second way.`
          : 'Add an email to send the PDF, or download it to print.'
        : 'Downloads the PDF with Sign and Date rules and marks the agreement handed over today. The job leaves the count; nothing is emailed.'
    default:
      return 'Files the builder’s signed subcontract as this job’s agreement — nothing of ours is sent.'
  }
}

export type WindowWayButton = { label: string; busyLabel: string; disabled: boolean }

/** The one button's label, and whether it can be pressed. */
export function windowWayButton(i: Pick<WindowSentenceInput, 'way' | 'paperSend' | 'email' | 'phone' | 'textToo'>): WindowWayButton {
  const email = i.email.trim()
  const phone = i.phone.trim()
  switch (i.way) {
    case 'link':
      if (email) return { label: i.textToo && phone ? 'Send the link by email and text' : 'Send the link', busyLabel: 'Sending…', disabled: false }
      if (phone) return { label: 'Text the link', busyLabel: 'Minting…', disabled: false }
      return { label: 'Send the link', busyLabel: 'Sending…', disabled: true }
    case 'here':
      return { label: 'Open the signing page', busyLabel: 'Opening…', disabled: false }
    case 'paper':
      return i.paperSend === 'pdf_email' ? { label: 'Email the PDF', busyLabel: 'Sending…', disabled: !email } : { label: 'Download & mark handed over', busyLabel: 'Building…', disabled: false }
    default:
      return { label: 'File their subcontract', busyLabel: 'Filing…', disabled: false }
  }
}

export type WindowPillInput = {
  status: 'draft' | 'sent' | 'signed' | 'voided' | null
  channel: 'link' | 'pdf_email' | 'handed'
  sentAt: string | null
  viewCount: number
  signedAt: string | null
  signerName: string | null
  /** A signed contract is already on file (history) while no live row exists. */
  signedOnFile: boolean
  notNeeded: boolean
  draftSaved: boolean
  /** "Sep 12" for an ISO stamp. */
  stamp: (iso: string) => string
}

/** The header pill: where this agreement stands, in the chip's words. */
export function windowStatusPill(i: WindowPillInput): { text: string; tone: 'gray' | 'amber' | 'green' } {
  if (i.status === 'signed' && i.signedAt) return { text: `✍ Signed ${i.stamp(i.signedAt)}${i.signerName ? ` · ${i.signerName}` : ''}`, tone: 'green' }
  if (i.status === 'sent' && i.channel === 'handed') return { text: `Handed over${i.sentAt ? ` ${i.stamp(i.sentAt)}` : ''} · awaiting the signed page`, tone: 'amber' }
  if (i.status === 'sent') {
    const opened = i.viewCount > 0 ? `opened ${i.viewCount}×` : 'not opened yet'
    return { text: `${i.channel === 'pdf_email' ? 'PDF emailed' : 'Sent'}${i.sentAt ? ` ${i.stamp(i.sentAt)}` : ''} · ${opened}`, tone: 'amber' }
  }
  if (i.notNeeded) return { text: 'Not needed · out of the count', tone: 'gray' }
  if (i.signedOnFile) return { text: 'Signed copy on file · a new agreement would supersede it', tone: 'green' }
  return { text: i.draftSaved ? 'Draft · saved, nothing sent yet' : 'Draft · nothing sent yet', tone: 'gray' }
}

/** The sweep's rule for a builder's job: a GC is on the job and the GC is not the customer row itself. */
export function jobTakesTheirSubcontract(j: { gc_customer_id?: string | null; customer_id?: string | null }): boolean {
  return Boolean(j.gc_customer_id) && j.gc_customer_id !== j.customer_id
}

export function emailLooksValid(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

export function phoneLooksUsable(s: string): boolean {
  return s.replace(/\D/g, '').length >= 7
}
