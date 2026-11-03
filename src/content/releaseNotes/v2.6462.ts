import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6462',
  date: '2026-11-03',
  title: 'A stopped crew’s check reads as a stage check at the top of the Dispatch inbox',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A check sent with Can’t do it still leads the Dispatch inbox. It now keeps its own row there: the Stage check tag, the stage and the check, and Open the check and Open the job.',
    'A red line over it says the reason and how long it has waited. It turns darker after half an hour, the same as a waiting customer.',
    'It no longer draws as the Customer waiting card, which read A customer with no number to call. With the row open, Lower priority sits beside the notes.',
  ],
}

export default note
