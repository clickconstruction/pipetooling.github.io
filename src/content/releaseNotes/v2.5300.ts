import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5300',
  date: '2026-10-12',
  title: 'GC mode: see where a trade partner or customer stands on their flow',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A company’s window and a customer’s window have a new Flow tab, with every step we take with them.',
    'Each step says if it is done, on now or lapsed, with its papers, its day and whose move it is.',
    'Press a step for its card: add a note, skip it for them, hold its reminder, or say you reminded them.',
    'See their page opens their portal as they see it.',
  ],
}

export default note
