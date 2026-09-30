import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4246',
  date: '2026-09-30',
  title: 'Forms that save as you type wait for a finished date',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'primary', 'controller', 'estimator'],
  highlights: [
    'Five forms that save as you type no longer save a date part way through: the job contract’s start and completion dates, a lien waiver’s through and signature dates, a bid’s due, estimated-start and plan dates, a payment’s Sent and Received dates, and an estimate’s Expires on and a change order’s Response requested by. A year typed one digit at a time, or as two digits like 26, used to be saved as the year 0002 or 0026 if you paused.',
    'A half-typed date is not saved, and it never clears the date that was there. On a bid, a payment and an estimate the rest of the form still saves, and a line says the date was not saved. Type the year in full and it saves.',
    'On the job contract and the lien waiver the whole draft waits for the date. The status line reads “Not saved: a date is not finished” until the year is typed in full.',
    'An estimate or change order does not go out while its Expires on or Response requested by date is half typed. It names the date to finish.',
  ],
}

export default note
