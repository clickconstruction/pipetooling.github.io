import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6490',
  date: '2026-11-04',
  title: 'A person who left prices the same on every Job Summary',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The Charges and Premium columns, the Charges window and the charged hours statement read every person’s Charged as from one place, so a dev and the controller see the same numbers for a job whose crew included someone who left.',
    'The controller’s Job Summary no longer says a person who left has no login for a Charged as.',
    'When two logins share a name, the one still here decides the standing.',
    'A master who is not pay-approved sees the Charges column unpriced, with the reason in the cell.',
  ],
}

export default note
