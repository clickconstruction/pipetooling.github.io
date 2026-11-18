import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7708',
  date: '2026-11-17',
  title: 'Lien desk: every press on the Board stands beside the name of the bin it empties (punch list #383)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The band between the Board’s tiles and its bins is gone. The chart of bins now starts right under the tiles.',
    'Each batch press stands on the same line as its bin’s name. Print and mail is on Approved · to print, Enter mail numbers is on Approved · to mail, Print for notarization is on Ready to file, and Mail the liens’ copies is on Filed · copies to mail.',
    'What a print leaves out reads on one line under the bin’s name, with the same doors as before: See them, Remind and Change.',
    'The Every bin and Only my bins switch is retired. A master reads every bin, and his Approve press stands beside the name of his Awaiting Master approval bin. The third tile opens the run again.',
  ],
}

export default note
