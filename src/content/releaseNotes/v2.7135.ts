import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7135',
  date: '2026-11-13',
  title: 'The law firm’s portal can be updated again',
  kind: 'fix',
  highlights: [
    'The service behind the law firm’s portal had grown past the size the server accepts, so a change to it could not go live.',
    'It now carries only what the portal needs, about a twentieth of what it carried before. Nothing changes on the portal itself.',
  ],
}

export default note
