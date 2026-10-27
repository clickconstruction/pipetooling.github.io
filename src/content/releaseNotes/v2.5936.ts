import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5936',
  date: '2026-10-26',
  title: 'Every door to the Legal desk opens its page',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The scales on the Pipeline\'s stage bar, the Legal desk row in the ☰ menu and the ⚖ Legal button on the Collections header now open the Legal desk\'s page, /legal-desk, in place of a window over the board.',
    'The scales are a link: hold ⌘ or Ctrl as you press them to open the desk in a new tab and keep the Pipeline in this one.',
    'The Dashboard\'s two law-firm lines and the Lien desk\'s Refer to the Legal desk button go to the page too. Back, or ← Pipeline at the top left, returns you to the Pipeline.',
    'An account under Given up on now opens on the page. Before, pressing one sent the desk back to the first account on the list.',
  ],
}

export default note
