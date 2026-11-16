import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7497',
  date: '2026-11-16',
  title: 'Lien desk: a filed lien’s copies have their own bin, a clock on the row, and one press on the Board (punch list #366)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Board’s last affidavit bin was one name for two states, Filed · Served. It is two bins now: Filed · copies to mail, and Served. A filed lien stays in the first until its copies are mailed and the day is recorded.',
    'Each chip in Filed · copies to mail is coloured by the day its copies must be mailed by. The bin has its own press, like Mail 12 liens’ copies, which opens the window that prints the copies and takes their mail numbers.',
    'On To do the row reads Lien filed · mail its copies by the day. It turns red the day before, and a late row says the day the copies were due. Its press is now Mail the copies.',
    'Two or more filed liens fold into one row under the bin’s name, with the same press as the Board.',
  ],
}

export default note
