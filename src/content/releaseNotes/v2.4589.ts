import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4589',
  date: '2026-10-05',
  title: 'Help: twenty-two more guides in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'subcontractor', 'helpers', 'primary'],
  highlights: [
    'Twenty-two more help guides, from "tell if a customer opened an estimate" through "write up a change order from the field", are rewritten in plain words: one idea per sentence, none over twenty words, every button and chip named exactly, a plain word beside each trade word the first time.',
    'Nothing in the app changes. Every fact, number and example in those guides is kept.',
  ],
}

export default note
