/**
 * What customers see, Messages cut 5: a text from the company number as the person's phone shows it. Each one is built
 * from the kernels' own words, so the tab shows what goes. `textToSend` gives the text as it goes, with the opt-out line
 * a first text carries. `helpAnswer` gives the app's answer to HELP. The people are the Messages prototype's made-up
 * ones, and the number and mailbox are made up until Settings → Phone and texts holds the real ones. Pure.
 */
import type { SampleTextId } from '../customerJourneys'
import { GC_COMPANY } from '../gc/company'
import { textToSend, type ComposeCompany } from '../messages/textOut'
import { helpAnswer } from '../quo/events'
import { fillLine } from '../quickReplies/blanks'
import { nudgeLine } from '../flows/nudgeDispatch'
import { SEED_FLOWS } from '../flows/seed'
import { stepById } from '../flows/state'
import { DEFAULT_LINES, tellFills, tellWords } from '../tellCustomer/tellCustomer'

/** Our company as a sample text names it: the GC's name, with a made-up number and mailbox. */
export const SAMPLE_TEXT_COMPANY: ComposeCompany = {
  name: GC_COMPANY.name,
  phone: '(210) 555-0100',
  mailbox: 'bids@clickconstruction.example',
}

/** One bubble: ours from the company number or theirs, with the office's note under it. */
export interface SampleTextBubble {
  side: 'ours' | 'theirs'
  text: string
  /** What the office should know about it, in plain words. Never shown to the person. */
  note: string | null
}

/** A text as the person's phone shows it: who it is from, who it is to, and the bubbles. */
export interface SampleText {
  from: string
  to: string
  bubbles: SampleTextBubble[]
}

/** A sample text, by its id on the journey step. */
export function sampleText(id: SampleTextId, company: ComposeCompany = SAMPLE_TEXT_COMPANY): SampleText {
  const from = `${company.name} · ${company.phone}`
  if (id === 'text-customer') {
    return {
      from,
      to: 'Elena Marchetti · (210) 555-0188',
      bubbles: [
        {
          side: 'ours',
          text: textToSend({
            body: 'Elena, pay application 3 for Fair Oaks Shops is in your portal.',
            links: [{ text: 'Your portal: ', link: 'click.co/p/7Hq2' }],
            reason: 'first',
            company,
          }).text,
          note: 'The first text to a number carries the opt-out line.',
        },
        { side: 'theirs', text: 'HELP', note: null },
        {
          side: 'ours',
          text: helpAnswer(company),
          note: 'The app answers HELP. Quo answers STOP itself, and the app stops texting that number.',
        },
      ],
    }
  }
  if (id === 'text-booked') {
    // Tell the customer (v2.5593): the Booked text as the sheet sends it, the app's own words filled from a made-up block.
    const fills = tellFills({ customerName: 'Elena Marchetti', me: 'Rosa Perez', jobName: 'Marchetti water heater', jobAddress: '1208 Mesquite Ln', block: { workDate: '2026-10-23', timeStart: '10:00:00', timeEnd: '12:00:00', techName: 'Luis Ortega' } })
    return {
      from,
      to: 'Elena Marchetti · (210) 555-0188',
      bubbles: [
        {
          side: 'ours',
          text: textToSend({ body: tellWords(DEFAULT_LINES.booked, fills, 'en').text, reason: 'first', company }).text,
          note: 'The office pressed Send on the Tell the customer sheet after saving her first visit. The first text to a number carries the opt-out line.',
        },
        { side: 'theirs', text: 'Great, see you Friday.', note: null },
      ],
    }
  }
  if (id === 'text-estimate') {
    // Tell the customer (v2.5594): the estimate's text as the sheet sends it, the link filled from the email's accept link.
    const fills = tellFills({ customerName: 'Elena Marchetti', me: 'Rosa Perez', jobName: null, jobAddress: null, estimate: { amount: '$1,850.00', title: 'Marchetti water heater' } })
    const body = fillLine(tellWords(DEFAULT_LINES.estimate, fills, 'en').text, { link: 'click.co/e/8Kp4' }).text
    return {
      from,
      to: 'Elena Marchetti · (210) 555-0188',
      bubbles: [
        { side: 'ours', text: textToSend({ body, reason: 'first', company }).text, note: 'The office pressed Send both on the Tell the customer sheet. The email went first, and the text carries the same accept link.' },
        { side: 'theirs', text: 'Got it, I will look tonight.', note: null },
      ],
    }
  }
  if (id === 'text-rating') {
    // Customer reviews (v2.5943, punch list #185): the Review asked step's own words as the morning run writes them, the
    // morning after her last bill was paid, with the rating link made for the job. Not the first text to her number, so
    // no opt-out line.
    const step = stepById(SEED_FLOWS.residential, 'review')
    const line = step ? nudgeLine({ first: 'Elena', reading: { kind: 'residential' } }, step) : ''
    const body = fillLine(line, { job: 'the water heater', rate: 'clicktooling.com/rate?t=9Mv2…' }).text
    return {
      from,
      to: 'Elena Marchetti · (210) 555-0188',
      bubbles: [
        { side: 'ours', text: textToSend({ body, reason: null, company }).text, note: 'The morning after her last bill was paid, the app prepared this for Today’s sends, and the office pressed Send. The link opens her review page.' },
        { side: 'theirs', text: 'Done. Luis was great.', note: null },
      ],
    }
  }
  return {
    from,
    to: 'Greg Paulk · (210) 555-0113',
    bubbles: [
      {
        side: 'ours',
        text: textToSend({ body: 'Greg, checking on the Boerne sitework number. Still good for today?', reason: 'first', company }).text,
        note: 'It goes from the company number, so his reply lands in his thread whoever answers.',
      },
      { side: 'theirs', text: 'Yes, end of day.', note: null },
    ],
  }
}
