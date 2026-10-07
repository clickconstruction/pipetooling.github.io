import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4672',
  date: '2026-10-06',
  title: 'Lien desk: the pile titles stay on screen as the Notices list scrolls',
  kind: 'feature',
  highlights: [
    'On the Notices list, each pile has a title with its count: Needs the owner, To draft, Awaiting approval, Ready to send, Missed. The titles stay on screen as you scroll. The ones you passed stack at the top and the ones ahead wait at the bottom.',
    'Press a title and the list scrolls to that pile. The pile you are in wears a blue bar.',
    'The Ready to send title carries the Send the run button. The pile chips above the list are gone, since the titles now do their work. A link that opens one pile still does, and its title offers Show every pile.',
  ],
}

export default note
