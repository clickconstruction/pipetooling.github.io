import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4258',
  date: '2026-09-30',
  title: 'Help: fifty more guides in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers', 'primary', 'superintendent'],
  highlights: [
    'Fifty more help guides, from "create, rename and share a roadmap" through "job follow-ups", are rewritten in plain words: one idea per sentence, none over twenty words, every button and chip named exactly, a plain word beside each trade word the first time.',
    'One guide had a hidden fault: a panel in "follow up with builders" never closed, so the twenty lines after it did not read as they should. It is fixed.',
    'Nothing in the app changes. 100 of 303 guides are done; the rest follow in batches of fifty.',
  ],
}

export default note
