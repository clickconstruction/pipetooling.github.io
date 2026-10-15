import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5548',
  date: '2026-10-14',
  title: 'Company phone seats: a seat shared by the office',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Settings → Phone and texts → Company phone seats, who answers on a seat can now be Shared by the office: one Quo login signed in on several phones, so the company number rings everyone without a seat per person.',
    'A call that seat takes reads the office answered, with nobody wrongly credited. A text from the reply box still carries your own name, and goes out from the shared seat when you have no seat of your own.',
  ],
}

export default note
