import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6641',
  date: '2026-11-07',
  title: 'Messages: the notice press comes first when the company was marked before',
  kind: 'feature',
  highlights: [
    'On the Who is this? card, when someone at the sender’s company was marked a notice before, the A notice, not a person block now sits first and says who was marked. The app suggests; a person presses.',
    'The presses are the same two: the address, and the company’s whole domain. Nothing is marked and nothing moves until you press, and Not a notice after all still undoes it.',
    'A sender on a shared mail service such as gmail.com gets no such hint, since a mark there says nothing about the next sender.',
  ],
}

export default note
