import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7744',
  date: '2026-11-18',
  title: 'Lien desk: a link to a job that is not on the list no longer opens another job',
  kind: 'fix',
  highlights: [
    'A link to the Lien desk can name one job. When that job was not on the list the link opened, the desk opened the first job on the list instead and said nothing. A press in that pane would have landed on the wrong job.',
    'The desk now opens no job in that case. A line in the pane’s place says the job is not on that list, on Monthly notices, Lien affidavits and Retainage notices alike.',
    'Two presses follow the line. Open its Lien window shows where the job stands. When another list holds the job, a second press opens it there.',
    'The address keeps the job while the line shows, so a reload says the same thing. Pick any row and the desk goes on as before.',
  ],
}

export default note
