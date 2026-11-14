/**
 * Bill Customer says what the customer will get (punch list #343, PR 1). The owner, 2026-11-13: "When assistant Taunya
 * sends out a bill, is it super clear on that screen what the customer is receiving?" It was not: the Stripe tab's press
 * made the bill and sent nothing without saying so, Send to showed one address with no name, and nothing said the PDF
 * email carries no pay link. This kernel holds the window's words for the two channels that reach a customer: the
 * caption under the tabs, the line under the address, the box above the press and the press itself. Pure: the window
 * (`SendRecordInvoiceModal`) hands it the payer as the composed job reads, and draws what comes back.
 *
 * PR 3 (one press): the Stripe tab's main press makes the bill and emails it, *Make the bill and email Dana*, and the
 * quiet press beside it, *Make the bill, send later*, keeps the old way for a bill handed over or texted. Two screens
 * had let a bill be made and never sent: Bills sent listed 24 open bills with no send on record on the day of the look.
 */
import { countedLabel } from '../batchWords'
import { greetingName } from '../contacts/names'
import { phoneContact } from '../phoneContact'

/** The two channels that send something. HouseCall Pro records only, and its own caption says so. */
export type BillSendChannel = 'stripe' | 'physical'

export interface TheyWillGetInput {
  channel: BillSendChannel
  /** Who is billed, as the composed job names them: the customer, the GC that pays, or the typed bill-to. */
  name: string | null | undefined
  email: string | null | undefined
  /**
   * The phone a text would go to. The window passes it only when the customer themself is billed: a text goes to the
   * job's customer, so under a GC payer or a typed bill-to the line is left out and nothing is promised.
   */
  phone?: string | null
  /** Every other address the send carries: ticked contacts, the copied other party, the one-off. Never the primary. */
  copyEmails: readonly string[]
  /** Stripe only: the dev's test mode, where the bill email comes to the sender and one copy with it. */
  testMode?: boolean
}

export interface TheyWillGet {
  /** Under the tabs: what this channel puts in front of the customer. */
  caption: string
  /** The payer's name for the Send to line; null when the job has none. */
  who: string | null
  /** Stripe only: the phone on the job and what it allows, or that there is none. Null when no phone was passed. */
  phoneLine: string | null
  /** Under the address: what a ticked person gets. */
  copyHelp: string
  /** The press, named for its act. On a Stripe bill it makes the bill and emails it. */
  press: string
  /** The box's first line. */
  pressTitle: string
  /** The box's sentences: what the press does, what it does not, where the copy is kept. */
  pressLines: string[]
  /** Stripe only: the quiet press that makes the bill and sends nothing, and the box's line about it. Null elsewhere. */
  later: { press: string; line: string } | null
}

export const BILL_CHANNEL_CAPTION: Record<BillSendChannel, string> = {
  stripe: 'An email with a Pay now button. They pay by card or bank on Stripe’s page.',
  physical: 'An email with the invoice PDF attached. It has no pay link.',
}

/** The Stripe tab's quiet press: the bill is made and nothing goes, as the one press did before PR 3. */
export const MAKE_BILL_SEND_LATER_PRESS = 'Make the bill, send later'

const PEOPLE = ['person', 'people'] as const

export function theyWillGet(input: TheyWillGetInput): TheyWillGet {
  const who = (input.name ?? '').trim() || null
  const email = (input.email ?? '').trim()
  const copies = input.copyEmails.length
  const caption = BILL_CHANNEL_CAPTION[input.channel]

  const first = who ? greetingName(who) : ''

  if (input.channel === 'stripe') {
    const phone = input.phone === undefined ? undefined : phoneContact(input.phone)
    const press = copies > 0 ? countedLabel('Make the bill and email', copies + 1, PEOPLE) : first ? `Make the bill and email ${first}` : 'Make the bill and email it'
    const goes = input.testMode ? `Test mode: the bill email comes to you, not to ${email}.` : `The bill email goes now to ${email}.`
    const copyLine = input.testMode ? 'One copy comes to you too. Nobody ticked gets one.' : `${copies === 1 ? '1 more person gets' : `${copies} more people get`} a copy of their own.`
    return {
      caption,
      who,
      phoneLine:
        phone === undefined ? null : phone ? `Phone ${phone.display}. A text can follow on the next screen.` : 'No phone on this job. A text needs a number on the customer.',
      copyHelp: 'Each person ticked below gets a copy of their own, with a Pay or view button.',
      press,
      pressTitle: `When you press ${press}`,
      pressLines: email
        ? ['The bill is made and marked billed.', goes, ...(copies > 0 ? [copyLine] : []), 'A text is your choice on the next screen.', 'Every send is kept in Bills sent.']
        : ['A Stripe bill goes by email. Add an email above first.'],
      later: { press: MAKE_BILL_SEND_LATER_PRESS, line: `${MAKE_BILL_SEND_LATER_PRESS} makes the bill and sends nothing. Use it for a bill you hand over or text.` },
    }
  }

  const press = copies > 0 ? countedLabel('Email the invoice to', copies + 1, PEOPLE) : first ? `Email the invoice to ${first}` : 'Email the invoice'
  const goes = !email
    ? 'This invoice goes by email. Add an email above first.'
    : copies > 0
      ? `One email goes now to ${copies + 1} addresses. Each one sees the others.`
      : `One email goes now to ${email}. The invoice PDF is attached.`
  return {
    caption,
    who,
    phoneLine: null,
    copyHelp: 'Everyone ticked below rides the same email and sees each address.',
    press,
    pressTitle: `When you press ${press}`,
    pressLines: email ? [goes, 'The bill is marked billed. No text goes with it.', 'The copy is kept in Bills sent.'] : [goes],
    later: null,
  }
}

/** The sample of each channel's email in Settings → What customers see, for the door beside the box. */
export function billSampleHref(channel: BillSendChannel): string {
  return `/settings?tab=settings-what-customers-see&step=homeowner/${channel === 'stripe' ? 'bill-email' : 'bill-by-email'}`
}
