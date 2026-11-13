import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7087',
  date: '2026-11-12',
  title: 'The app’s own tests use made-up names',
  kind: 'infra',
  highlights: [
    'The tests that check the app before each release now use made-up names and streets in place of ones that read like real customers, builders, owners and job sites.',
    'The sample emails under Settings, What the team sees, and the sample test report show made-up names too.',
    'Nothing else on any screen changes.',
  ],
}

export default note
