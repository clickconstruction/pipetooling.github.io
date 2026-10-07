import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4844',
  date: '2026-10-07',
  title: 'Version numbers are reserved on GitHub, so every machine sees them',
  kind: 'infra',
  highlights: [
    'A session claiming the next version or migration stamp now records it on GitHub, and sessions on other computers or in the cloud see it at once.',
    'A number already on an open pull request counts as taken, even when nobody ran the claim.',
    'The sessions board lists every claim across machines and calls out two pull requests that share a number before either lands.',
    'A short paragraph can be printed to hand to anyone starting an agent on another machine.',
  ],
}

export default note
