import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5120',
  date: '2026-10-09',
  title: 'The Dashboard’s money leaves out ZZ test jobs',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The Billed pin and the AR card on the Dashboard drop by the test money only. Nothing real changed. The Ready to bill and Billed lists leave out ZZ test jobs too.',
    'The Pipeline, Quickfill and the Dashboard now agree again.',
    'A dev hides or shows the test jobs with one line in the Pipeline’s Hide groups. They start hidden, and a chip says how many.',
  ],
}

export default note
