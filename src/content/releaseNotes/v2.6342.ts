import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6342',
  date: '2026-11-02',
  title: 'A bid pins the set it was priced on, and a job opened from it starts building from that set',
  kind: 'feature',
  highlights: [
    'Edit Bid → Plans → Plan sets: press Priced on this set on a row to pin the set the price stands on. The row wears a Priced on chip and a line under the list says which set, or that the robot’s set stands in while none is pinned.',
    'A job opened from the bid now starts with that set as what it builds from: its Documents → Plans reads Building from, and Open plans on the Job tab opens the set. On a development the job joins the part already building from the same set, so no second part appears.',
    'When a job’s part later moves on to a newer set, an amber note under the bid’s sets says which set, dated, and that the bid was priced on the old one, with Open the set and a door to the job’s Documents tab.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
