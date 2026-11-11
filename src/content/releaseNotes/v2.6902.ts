import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6902',
  date: '2026-11-10',
  title: 'The Bridge’s old sheet email is retired',
  kind: 'fix',
  highlights: [
    'The email behind the old Email me this sheet press is gone. Nothing on the Bridge had sent it since the Monday sheet left the page.',
    'Settings → Team emails now shows the Bridge’s weekly email as it goes out: the first screen, with the week’s call.',
    'The weekly email itself is unchanged. It still goes to the owner and every dev on Monday at 6 AM Central.',
  ],
}

export default note
