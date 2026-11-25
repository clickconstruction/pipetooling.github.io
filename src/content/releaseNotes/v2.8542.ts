import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8542',
  date: '2026-11-24',
  title: 'Addresses that look alike: Fix the spelling, and Open the job on an address with no street number',
  kind: 'feature',
  highlights: [
    'A pair in Addresses that look alike has a third press, Fix the spelling…. It opens a small window that asks which spelling to keep and names every job and bid written the other way.',
    'Each one is ticked. Untick any you want left alone, then press Change N addresses. Nothing changes before that press.',
    'When the change would take a number off an address or put one on, such as a unit, the window says so first.',
    'On the No street number tab, each job has Open the job. It opens the job on its Edit tab with the Job Address box ringed.',
  ],
}

export default note
