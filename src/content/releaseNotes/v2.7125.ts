import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7125',
  date: '2026-11-13',
  title: 'People → HR shows what an agent is waiting on you for',
  kind: 'feature',
  highlights: [
    'Waiting on you lists the plans an agent kept on HR files for a yes, oldest first.',
    'Each row says in words what the plan would write, who kept it and how long it has waited.',
    'To say yes, tell the agent in a session. The plan is checked against the file again before it is written.',
  ],
}

export default note
