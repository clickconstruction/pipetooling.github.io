import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3739',
  date: '2026-09-22',
  title: 'Approving on an iPhone: the Full name box keeps what AutoFill put in it',
  kind: 'fix',
  highlights: [
    'A customer approving an estimate on her iPhone picked her name from the suggestion above the keyboard, ticked the agree box, and watched the name vanish — "Please enter your full name." every time. Safari fills the box without telling the page, and the page was rewriting the box from what it remembered on every tick. It now leaves the box alone and reads it when you press Submit.',
    'Same box on the contract, sub work-order, lien release and GC bid-room signing pages. Typing, clearing and the cursive preview work as before.',
    'If a customer is still stuck: a "A new version is ready — Reload" pill at the bottom of their page means their phone is on an older copy; tapping Reload brings this fix in.',
  ],
}

export default note
