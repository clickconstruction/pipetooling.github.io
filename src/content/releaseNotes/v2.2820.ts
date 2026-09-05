import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2820',
  date: '2026-09-05',
  title: 'Job Summary — Cut by GC, service type, lead tech, and more',
  kind: 'feature',
  highlights: [
    'A Cut by chip on Jobs → Job Summary groups the table by GC, service type, lead tech, Account Man, customer, development, or bill month. Every group gets a bold subtotal row — revenue, costs, overhead, true profit, true margin — and a ranked bar beside the table.',
    'The bars name the concentration ("top 3 = 71% of true profit"), mark groups under your Target margin, and with Compare to on each subtotal shows how its margin moved in points.',
    'A new $/hr column: revenue ÷ approved field hours, per job and per group — the realized rate.',
  ],
}

export default note
