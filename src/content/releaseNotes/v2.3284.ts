import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3284',
  date: '2026-09-11',
  title: 'Every Billed row says how reliably this customer pays',
  kind: 'feature',
  highlights: [
    'Under the expected-pay chip on Billed Awaiting Payment rows, a small line now reads the customer\'s record: "Pays in 9–41d" is their real range from bill to money over the last year, with a six-bar sparkline of their last bills (green at or under their usual, amber up to half again, red beyond).',
    'When promises exist, the line adds "keeps 3 of 7 · slips ~9d" — how many of their promised dates they kept, and how many days after their word the money usually lands. Office roles see the record; primary sees the pay range.',
    'The Payment forecast now files a promised bill by the promise plus that customer\'s usual slip, and says "usually slips ~9d" on the row, so a promise from a customer who runs late lands in the week the money actually tends to arrive.',
    'Nothing to fill in: it all comes from payments already recorded and promises already captured.',
  ],
}

export default note
