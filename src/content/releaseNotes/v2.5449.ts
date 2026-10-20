import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5449',
  date: '2026-10-13',
  title: 'Job Mode: message the customer from the job, switched off for now',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Job Mode gains Message the customer for the techs on the job. It stays off until texts can go from the phone.',
    'A tech picks a line the office wrote, sees it filled for this job, and types only what the app cannot know.',
    'Something else leaves a note on the job, and the office sends the customer what they should hear.',
    'An orange dot on the button means the customer wrote back.',
  ],
}

export default note
