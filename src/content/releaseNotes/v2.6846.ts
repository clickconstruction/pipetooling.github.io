import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6846',
  date: '2026-11-10',
  title: 'People → Users: See what they see shows you the screen a teammate who is away meets at sign-in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Each Away row has a new press, See what they see, beside Edit the note… and Bring back….',
    'It opens their sign-in screen as a preview: the note, the countdown, where the office is and the office line, as they will read it.',
    'An amber bar says it is a preview and whose screen it is. You stay signed in as yourself, and nothing is saved.',
    'On the day shows the screen the countdown ends on. The buttons on their screen do nothing in the preview.',
  ],
}

export default note
