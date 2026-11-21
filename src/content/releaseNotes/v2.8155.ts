import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8155',
  date: '2026-11-21',
  title: 'Document builder: Publish to N jobs goes to the jobs it says, or publishes nothing',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, the button that publishes your usual reads every job again before it publishes anything.',
    'If a teammate changed or published a job since your page read it, nothing is published. The rows and the button then show where your usual goes now, and you press again.',
    'When the same jobs still get it, the first press goes through as before.',
  ],
}

export default note
