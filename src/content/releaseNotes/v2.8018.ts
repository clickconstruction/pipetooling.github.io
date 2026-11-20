import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8018',
  date: '2026-11-19',
  title: 'Before we start: the GC’s page can show what we need, and take their answer',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A job can show its GC what we need before each stage. It is off until you turn it on under Before we start.',
    'Their page lists what is still needed with a large box on each. They tick what is ready, add a photo, or send a day.',
    'Their tick lands on the stage as a yes on their word. Their page never shows a bullet of ours, a name or a cost.',
    'After a Go with nothing open, their page reads Crew confirmed for our first day.',
  ],
}

export default note
