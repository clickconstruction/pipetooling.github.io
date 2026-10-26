import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5879',
  date: '2026-10-26',
  title: 'A dev opens the app on the Bridge',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Opening the app, or signing in, lands a dev on the Bridge instead of the Dashboard. Everyone else lands where they did.',
    'The Dashboard stays one press away in the header, and a link straight to the Dashboard or any other page opens where it points.',
  ],
}

export default note
