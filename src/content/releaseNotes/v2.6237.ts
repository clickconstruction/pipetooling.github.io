import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6237',
  date: '2026-10-31',
  title: 'A bid you took robot fixtures on reads assisted, and the fixtures are scored',
  kind: 'feature',
  highlights: [
    'When you take robot fixtures on a bid, its run keeps its sealed number and still scores at send. The Robot Board, the envelope and the Scoreboard mark it assisted. It sits beside the practice runs and never counts toward a job type\u2019s streak.',
    'At send the fixtures themselves are scored against your final list: how many you took, changed or set aside, and how many the robot missed. The line reads on the Robot Board row and in the envelope.',
    'The robots are now reminded to hand their fixtures over as they price each shadow, so the list shows up on the next bid they seal.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
