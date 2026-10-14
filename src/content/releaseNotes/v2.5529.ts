import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5529',
  date: '2026-10-14',
  title: 'Lien desk: a notice in the mail whose date has passed no longer reads as overdue',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Lien desk’s Deadlines tab, a month whose notice is printed and in the mail, but whose date has passed, set the job’s notice date to that past day when no other notice was owed. The row read like “notice by Jul 15 · -91 d” and sat with the overdue jobs.',
    'That month now keeps its amber envelope. With no other notice owed, the row reads on to the lien date, as a month on file does, and its hover says to record the mailing before the lien is filed. The envelope’s own hover says the date has passed and asks for the tracking number and the day it went out.',
  ],
}

export default note
