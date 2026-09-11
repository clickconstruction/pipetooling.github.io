import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3258',
  date: '2026-09-10',
  title: 'Overhead allocation: the kernel behind the coming smoothing and carry',
  kind: 'feature',
  highlights: [
    'Groundwork only — nothing changes on screen yet. Job Summary still charges each job its share of the day it was worked.',
    'Under the hood, the day ledger now carries the sixty days before your Worked-in window, and a new allocation engine can spread each day’s office cost across the field hours of the following weeks and hand a slice to every open job.',
    'At today’s settings the engine reproduces the current numbers to the cent, and whatever the settings, the pool always reconciles: what the office spent equals what jobs were charged plus what had nobody to charge plus what is still in flight.',
    'The dials to turn it on, the per-day view of who received overhead, and the app-wide default follow in the next two releases.',
  ],
}

export default note
