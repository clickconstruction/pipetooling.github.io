import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5900',
  date: '2026-10-26',
  title: 'One index of every door the app has, with its words and its gate',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every page, tab, window, Settings card, guide and to-do the app can open is now one list, each entry with the words people type for it, the link that already works, and the gate that says who may open it.',
    'The gates are the helpers the app already trusts, so a door opens for exactly the people the page lets in, and a test holds every link to a real route and every role to the route guard.',
    'Nothing changes on screen yet. The header search reads this list in the next release, and the Dev doors card in Settings is folded in rather than copied.',
    'Settings search gains three cards it did not know: Estimate defaults, the estimate terms editor and the bid cover letter defaults, each landing on its card.',
  ],
}

export default note
