import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2823',
  date: '2026-09-05',
  title: 'Job Summary — a Cycle view: work → bill → paid, and who’s stuck',
  kind: 'feature',
  highlights: [
    'A fifth view on Jobs → Job Summary. Two lags per job from dates already on the invoice and the payment: how long after the last field day the bill went out, and how long after that it was paid. Medians by bill month, side by side, with a 30-day line.',
    'Tiles for the whole cycle (last day on site to cash), the slowest and fastest payers, and open jobs; Compare to shows the change in days.',
    'The stale-open list: every open job with no field work for 14, 21, or 30+ days, longest first, with the GC, the lead tech, and the contract. Click a row to open the job.',
  ],
}

export default note
