import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2025',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Payment chase loop: the Pipeline keeps your follow-up call list',
  highlights: [
    'New "📞 Ask N customers when they\'ll pay" card in Today\'s Money Opportunities — every bill past its expected date with no promise, grouped by customer, biggest dollars first.',
    'Start call mode works the list one customer at a time: every late bill with its evidence (billed date, how it went out, partials), bills as checkboxes so one call can record several answers, and Friday quick-picks that mark promises on the spot.',
    "Can't reach snoozes a customer (tomorrow / 3 days / 7 days) and brings them back automatically; a promise unpaid 7 days past its date returns as a broken promise; disputes park for review instead of getting pointless re-calls.",
    'Finishing the queue shows a wrap-up — dollars that now have dates, resends, snoozes, disputes — and every touch logs who called and what the customer said.',
  ],
}

export default note
