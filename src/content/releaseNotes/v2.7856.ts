import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7856',
  date: '2026-11-18',
  title: 'Lien desk: Back from the clerk records every filed lien in one window',
  kind: 'feature',
  highlights: [
    'The Board’s Ready to file bin has a new line, Back from the clerk?, with the press Enter document numbers. It opens one window with a line for each approved lien.',
    'Type the number from the clerk’s stamp and press Enter. That lien is recorded as filed at once, and the cursor moves to the next. A number another lien holds is not recorded.',
    'Choose the stamped liens takes the clerk’s PDFs at once. A file named with its job number goes to that lien, and a document number in the name is typed in. One counted press records them after you check each against the stamp.',
    'The window Filed liens: copies to mail has the same door at its top while approved liens are not on record yet.',
  ],
}

export default note
