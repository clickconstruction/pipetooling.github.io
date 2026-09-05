import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2838',
  date: '2026-09-05',
  kind: 'fix',
  title: 'Automatic job creation will not duplicate a job you already typed — and never turns a change order into a job',
  highlights: [
    'When "Create jobs automatically" is on and a customer signs, the app now checks for a job you already made by hand — same customer, same name, same value, opened in the last 90 days — and leaves it alone instead of minting a twin. The email then offers "Create the job" so you can link the existing one.',
    'A signed change order never becomes a new job. If it is already on a job, the email points to that job; otherwise "Create the job" opens the Apply-to-job window, where you pick the job and confirm the change to its total.',
    'A job the app does create carries an activity line — "Job opened automatically from signed estimate #N" — so you can always tell how it got there.',
  ],
}

export default note
