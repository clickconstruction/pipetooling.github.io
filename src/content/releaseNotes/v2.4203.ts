import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4203',
  date: '2026-09-29',
  title: 'Pipeline: the Done and Billed labels are underlined',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a Pipeline row, the label above the billing date now reads BILLED instead of BILL — it names what already happened, not something still to do.',
    'DONE, BILLED and PAID are underlined, so the stages a job has reached stand apart from NEXT, ENDS and LAST, which only describe the calendar.',
  ],
}

export default note
