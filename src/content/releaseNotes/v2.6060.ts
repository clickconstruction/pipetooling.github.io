import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6060',
  date: '2026-10-29',
  title: 'Dashboard and Messages: what waited while you were off, and who is off',
  kind: 'feature',
  highlights: [
    'When your Push me hours held a push, the Dashboard’s Needs you card lists it when you open the app: While you were off: 3 replies and a work order waited, since when, and who answered meanwhile. See them opens the first one still waiting. Nothing is pushed when your hours open.',
    'On a thread, the Who has it pill says when the person who has the replies is off: Rosa has this · off until 6 AM. When nobody has it and the whole office is off, the pill says so, and its hover says the reply waits on Needs a reply.',
    'The Office hours card, while the office is open around the clock, names the hours nobody in the office is pushed: Nobody hears a reply from 11 PM to 6 AM. Rosa, Evan and Taunya are all off then. The owner and a dev see it.',
    'The pill’s off words reach the whole office once its database change is pushed. Until then the owner and a dev see them.',
  ],
}

export default note
