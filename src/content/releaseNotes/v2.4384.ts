import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4384',
  date: '2026-10-02',
  title: 'Procurement log: see which part belongs to which fixture',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'By tag on the Submittals procurement log now reads like a folder list. Each fixture sits at the left edge, and its parts sit one step in, joined to it by a line.',
    'When a fixture mixes an assembly with other parts, like a water cooler with a carrier added by hand, the assembly’s parts sit one step further in under its name.',
    'A fixture made of one assembly says so on its own line. On To order and By house, each part names the assembly it came from.',
  ],
}

export default note
