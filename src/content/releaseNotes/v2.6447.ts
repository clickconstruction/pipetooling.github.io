import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6447',
  date: '2026-11-03',
  title: 'The Statement of charges: a job’s labor and materials, priced, on one paper for the customer',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'In a job window’s Documents tab, Statements of charges sits under Hours statements. Press Statement of charges… and the window reads the job: every crew-day in the span at the rate card or the job’s rule, every material line at the markup over cost, and the adjustments the office made in the Charges window.',
    'The paper beside the switches is the print. Office copy on, it carries cost, margin, the premium or shortfall against the price and the adjustments in a box marked office only. Off, it is the customer copy: charged amounts only. A line under the table can name how many days came from the pay records.',
    'Save files it as SC-<job>-<n> with its snapshot, so it prints again as it read even after the rate card or the job’s rule changes. Print saves it as printed. The section lists every statement with its labor, materials and charged figures and who saved it.',
    'Cents read smaller than dollars on every charges figure, the paper included.',
  ],
}

export default note
