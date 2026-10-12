import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5339',
  date: '2026-10-12',
  title: 'Messages: quick replies start with the step a person is on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The quick replies put the lines for the step a person is on first.',
    'Find a reply says where they are in the flow, how long they have been there, and what finishes the step.',
    'A press on the step’s card opens that step.',
  ],
}

export default note
