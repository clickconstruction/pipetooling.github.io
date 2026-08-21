import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2023',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal addresses now live at my.clickplumbing.com',
  highlights: [
    'The address in the portal modal — and what Copy link puts on your clipboard — is now my.clickplumbing.com/their-name.',
    'Old pipetooling.com/p/ links keep working; the new domain simply redirects there.',
  ],
}

export default note
