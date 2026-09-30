import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4225',
  date: '2026-09-30',
  title: 'An alternate nobody answered stays in the job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A won bid’s alternate used to count as declined unless someone had ticked it, so a bid won before the question was asked quietly dropped those rows from the job. Now only an alternate marked Declined leaves the job.',
    'Marking a bid Won asks Taken, Declined or Not sure for each alternate, starting on Not sure.',
    'On a bid that is already won, the alternate’s heading on the Counts tab asks “did they take it?”, and the Bid Board shows “alt ?” until someone answers.',
    'When a customer signs the bid room, the add-ons they left unticked are recorded as declined.',
  ],
}

export default note
