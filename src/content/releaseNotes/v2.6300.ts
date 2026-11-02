import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6300',
  date: '2026-11-02',
  title: 'Line budgets: what each line should cost, the owner tunes it in place, and the Costs tab reads where we are',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a project, every line item on the Bill tab carries a quiet budget line under its name: hours, labor dollars, materials dollars and where the split came from. A typed line reads the company split for its kind, marked ≈ assumed.',
    'The owner taps the line and two sliders open under it, Labor and Materials, with the margin reading out below. Every drag saves by itself and Back to puts the split where it was.',
    'The Costs tab opens with Where we are: spent of the whole budget with the job’s percent done, a Labor bar and a Materials bar with the percent as a mark, and one row per line with its own bar.',
    'Two smaller changes on the Bill tab: tap a line’s badge, the number or the diamond, to flip it between In order and Any time, with the kind written under it; and the cents read small in the price boxes and the Job Total.',
  ],
}

export default note
