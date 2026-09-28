import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4070',
  date: '2026-09-28',
  title: 'Cover Letter: the schedule of values can be your own lines',
  kind: 'feature',
  highlights: [
    'Under the Schedule of values pill, pick the shape: By stage (the takeoff writes the three lines and keeps them current) or My lines (your own lines — rename, add, reorder, remove, a note on each). The first switch to My lines seeds the three stages as they stand; switching back keeps your lines for next time.',
    'A bar under the lines checks them against the contract and says the gap; one click scales every line to the contract, labor with its line. Paste the GC’s line names from their form and the lines appear with blank values; Seed again from the stages starts over (it asks first).',
    'With Split labor and material on, each line takes a typed labor figure, or the company share when blank. The letter, the Approval PDF and the printed schedule (now in the pay-application form: #, description, labor, material, scheduled value, notes) all follow the shape.',
  ],
}

export default note
