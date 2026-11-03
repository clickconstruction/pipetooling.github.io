import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6413',
  date: '2026-11-03',
  title: 'Signed hours statements on the Legal desk: ask each worker, put the signed copy on the matter, a lettered exhibit (punch list #212, PR 4)',
  kind: 'feature',
  highlights: [
    'The Legal desk’s Evidence tab now carries Signed statements under each job in Proof the work happened: every hours statement made for the job with its record, worker, period, hours and where it stands, and Ask <name>… for each worker who clocked there, which opens the Hours statement window on that job with them picked.',
    'Add to evidence on a signed statement copies its signed PDF onto the matter’s Evidence tab, titled and dated the signing day with one line on what it shows, and the statement points at the copy. Show on Evidence ↗ then lands on the row. The firm reads it with the documents from the office.',
    'What goes to the firm letters the signed statements as their own exhibit under Field evidence, and the printed packet lists them under D with the field evidence.',
    'A job the app has no clock for, worked before the app’s first day, reads as a gap job: it says a statement there would be the worker’s own, not the company’s record, and asks no one.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
