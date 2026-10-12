import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5318',
  date: '2026-10-12',
  title: 'Messages: How it is going reads the time each step took',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Groundwork for Settings → Flows. Nothing changes on screen yet.',
    'How long each step usually takes, and where it sticks, will come from the days each company really spent on it.',
    'The funnel counts each job from the day we asked.',
  ],
}

export default note
