import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5323',
  date: '2026-10-12',
  title: 'Settings → Flows: set up the steps each person goes through',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Settings has a Flows tab for the steps each customer, trade partner and architect goes through.',
    'Pick what finishes each step from the facts the app keeps. Change whose move it is, the nudge and the papers.',
    'Every change is tried on everyone before you save. Save keeps all of it at once.',
    'History shows each change with who made it, and How it is going shows where steps stick.',
  ],
}

export default note
