import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5255',
  date: '2026-10-12',
  title: 'Messages: the step card and the reminders from a flow',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'The app can now write a step card. It says where the step stands and what comes next.',
    'It can also tell which reminders belong on Follow up today. The card and Follow up read one rule.',
    'A reminder never repeats a message we sent within its quiet days.',
  ],
}

export default note
