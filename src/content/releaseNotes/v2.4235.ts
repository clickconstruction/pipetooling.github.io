import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4235',
  date: '2026-09-30',
  title: 'Help: the first fifty guides in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers', 'primary', 'superintendent'],
  highlights: [
    'Fifty help guides, from "add a customer" through "create an assembly while doing a takeoff", are rewritten in plain words: one idea per sentence, none over twenty words, every button and chip named exactly, a plain word beside each trade word the first time.',
    'Nothing in the app changes, and every example in the guides is kept word for word. Open Help and read any of them.',
    'The other 252 guides follow in batches of fifty.',
  ],
}

export default note
