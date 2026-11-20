import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8008',
  date: '2026-11-19',
  title: 'Document builder: a job’s insurance sheet opens by a link',
  kind: 'feature',
  highlights: [
    'A published insurance sheet has a link. It opens the sheet with no sign-in, for a sub’s insurance agent.',
    'The link always shows the published revision, never a draft. It can be copied, replaced or switched off.',
    'The card counts how often someone outside opened the link. A teammate’s own look is not counted.',
    'Only a dev sees the builder. The app sends the link to nobody. A person copies it.',
  ],
}

export default note
