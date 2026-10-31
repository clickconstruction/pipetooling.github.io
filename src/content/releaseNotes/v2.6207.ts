import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6207',
  date: '2026-10-30',
  title: 'A memo line on every plan set, in Edit Bid, on the Development page and from a robot',
  kind: 'feature',
  highlights: [
    'On the Development page the Plans look shows each set\'s memo. Press it to change it, or press Add a memo to write what changed on the plans.',
    'In Edit Bid under Plan sets, a saved set\'s memo edits in place: press the words or Add a memo, type, press Enter.',
    'A robot that reads the plans can write the same memo on its own bid, to record what it thinks changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
