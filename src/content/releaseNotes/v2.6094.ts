import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6094',
  date: '2026-10-29',
  title: 'Quickfill: Fill them in prices the sub work orders waiting on one',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The Fill them in rows on Quickfill’s Today’s lines now include the sub work orders drafted without a price. Oldest first, each with the sub, the job, the scope lines ticked, the proposed window and the bid’s sub-labor total when the job has a bid.',
    'Type the subcontract amount, or tap From the bid to take the bid’s total. Save and next writes the price on the draft, the same number the assembler’s price box takes. The send stays on the Work board, where the draft’s Next now reads Send for signature.',
    'Undo clears the price. Open the draft opens it in the assembler for anything else.',
  ],
}

export default note
