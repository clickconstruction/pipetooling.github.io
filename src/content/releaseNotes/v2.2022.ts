import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2022',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Payment forecast: click the pay-speeds strip for the breakdown',
  highlights: [
    'The Pay speeds strip in the Payment forecast is now a door — click it to see who is behind the averages.',
    'The breakdown charts every customer with open billed money on a days axis (bigger dot = more open dollars), with a count-by-speed-bucket view one pill away.',
    'Below the chart, customers rank slowest first with their payment count and the open dollars riding on their speed — the top of the list is your follow-up list.',
    'Customers with under 3 measured payments sit in their own thin-history tier, because their forecasts run on the company median.',
  ],
}

export default note
