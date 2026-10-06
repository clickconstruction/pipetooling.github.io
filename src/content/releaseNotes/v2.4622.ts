import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4622',
  date: '2026-10-05',
  title: 'Legal portal: a hidden form box can no longer swallow the firm’s entries',
  kind: 'fix',
  highlights: [
    'The law firm’s portal had a hidden spam trap on its forms. Had a browser or password manager filled it, an entry would have shown Saved and not been kept.',
    'The trap is gone. The portal’s private link, its hourly limit and its other checks still guard the forms.',
  ],
}

export default note
