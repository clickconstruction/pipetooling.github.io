import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5374',
  date: '2026-10-12',
  title: 'Lien desk: the checklist comes alive, the lanes, and the run’s bar on the desk (run train, PR 5)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Once the packet prints, the run shows the checklist sheet live: one row per envelope with stuffed, slip on and mailed boxes and the number box, so it can be ticked at the counter from a phone. A number typed there is the envelope’s number.',
    'When envelopes travel more than one way, certified and by hand for instance, each way is a lane under the journey with its envelopes and how far they are.',
    'The run’s door on the desk carries a small bar: green for sealed, amber for what waits on the leader, and the count of who waits. Nobody opens the run to find out.',
  ],
}

export default note
