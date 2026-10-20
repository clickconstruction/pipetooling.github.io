import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5510',
  date: '2026-10-13',
  title: 'Follow-ups: a job with no crew on site in 21 days joins the deck, with a Next line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Follow-ups deck on Jobs → Pipeline now deals every Working or Waiting job with no approved field day in 21 or more days, however recent its notes. The card’s Why it’s here line reads like “No field work in 46 days · 70% done · $41,550 bid”.',
    'Every card now knows what the job needs next: Bill it, Schedule the next visit or close it, Put the next visit on the schedule, Nudge the customer for payment, or Work the account. The deck shows it in the next release.',
    'Looks fine rests an idle job for the usual few days and Snooze parks it to a date; a visit already on the schedule keeps it out. The longest-neglected job deals first.',
    'The Dashboard’s “jobs are waiting on a follow-up” card counts the quiet jobs alone, so an idle job is never counted twice once the idle card opens the deck.',
  ],
}

export default note
