import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8190',
  date: '2026-11-21',
  title: 'Sent copies: a sheet from the Document builder is under Contracts and estimates, with its job',
  kind: 'fix',
  highlights: [
    'A sent insurance sheet, a printed one and a Sub NDA sent to a GC were all under Other on Sent copies. They are now under Contracts and estimates.',
    'A sent sheet carries its job when the project bills through one, so it shows with that job’s other papers.',
    'A Sub NDA sent to a GC carries the job it is about, and the customer it went to.',
  ],
}

export default note
