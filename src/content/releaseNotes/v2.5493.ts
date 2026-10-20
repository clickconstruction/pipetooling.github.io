import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5493',
  date: '2026-10-13',
  title: 'Messages: the papers a step waits on are starred in Attach',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When someone is on a step that waits on their W-9 or their master agreement, Attach starts with that form.',
    'The form goes as our link to their portal, at their papers, where they fill it in.',
    'The stars show only when they have a portal link.',
  ],
}

export default note
