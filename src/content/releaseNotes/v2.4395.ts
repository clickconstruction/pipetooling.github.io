import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4395',
  date: '2026-10-02',
  title: 'Takeoffs: see what your materials cost at today’s book, and catch up',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Takeoffs shows a blue line when book prices moved since you picked them, and what the materials cost at today’s book.',
    'Refresh prices brings those lines to today’s price from the same supply house. Prices you typed stay as they are.',
    'A sent bid shows the gap only, until you press Revise on Pricing. Pricing shows the same gap in one line.',
    'A book price that looks wrong is left out and named, with a link to fix it in Materials.',
  ],
}

export default note
