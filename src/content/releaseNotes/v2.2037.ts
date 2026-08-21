import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2037',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal visit requests: pick the property, not the job',
  highlights: [
    'The Request-a-visit form now lists addresses — tappable ruled rows instead of a dropdown of job numbers and internal job names.',
    'Multiple jobs at the same property collapse into one row; the office still receives the request against the right job.',
    'Long lists stay tidy behind "Show all N properties."',
  ],
}

export default note
