/**
 * Bill Customer says what the customer will get (punch list #343, PR 1). The owner, 2026-11-13: "When assistant Taunya
 * sends out a bill, is it super clear on that screen what the customer is receiving?" It was not: the Stripe tab's press
 * made the bill and sent nothing without saying so, Send to showed one address with no name, and nothing said the PDF
 * email carries no pay link. This kernel holds the window's words for the two channels that reach a customer: the
 * caption under the tabs, the line under the address, the box above the press and the press itself. Pure: the window
 * (`SendRecordInvoiceModal`) hands it the payer as the composed job reads, and draws what comes back.
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
  /** The press, named for its act. */
  press: string
  /** The box's first line. */
  pressTitle: string
  /** The box's sentences: what the press does, what it does not, where the copy is kept. */
  pressLines: string[]
}

export const BILL_CHANNEL_CAPTION: Record<BillSendChannel, string> = {
  stripe: 'An email with a Pay now button. They pay by card or bank on Stripe’s page.',
  physical: 'An email with the invoice PDF attached. It has no pay link.',
}

/** The Stripe tab's press: the verb the Bills tab already uses for this act. */
export const MAKE_STRIPE_BILL_PRESS = 'Make the Stripe bill'

const PEOPLE = ['person', 'people'] as const

export function theyWillGet(input: TheyWillGetInput): TheyWillGet {
  const who = (input.name ?? '').trim() || null
  const email = (input.email ?? '').trim()
  const copies = input.copyEmails.length
  const caption = BILL_CHANNEL_CAPTION[input.channel]

  if (input.channel === 'stripe') {
    const phone = input.phone === undefined ? undefined : phoneContact(input.phone)
    return {
      caption,
      who,
      phoneLine:
        phone === undefined ? null : phone ? `Phone ${phone.display}. A text can follow on the next screen.` : 'No phone on this job. A text needs a number on the customer.',
      copyHelp: 'The bill email goes to that address from the next screen. Each person ticked below gets a copy of their own, with a Pay or view button.',
      press: MAKE_STRIPE_BILL_PRESS,
      pressTitle: `When you press ${MAKE_STRIPE_BILL_PRESS}`,
      pressLines: [
        'The bill is made and marked billed.',
        `Nothing goes to ${who ?? 'the customer'} yet. The next screen sends it by email or by text.`,
        'Every send is kept in Bills sent.',
      ],
    }
  }

  const first = who ? greetingName(who) : ''
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
  }
}

/** The sample of each channel's email in Settings → What customers see, for the door beside the box. */
export function billSampleHref(channel: BillSendChannel): string {
  return `/settings?tab=settings-what-customers-see&step=homeowner/${channel === 'stripe' ? 'bill-email' : 'bill-by-email'}`
}
