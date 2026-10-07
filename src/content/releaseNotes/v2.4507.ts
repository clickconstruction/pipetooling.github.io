import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4507',
  date: '2026-10-04',
  title: 'Release of Lien: Unconditional asks before it switches',
  kind: 'feature',
  highlights: [
    'Clicking Unconditional in the Release of Lien window now opens a warning first. It asks if you have spoken to your master plumber, and says most GCs will accept a conditional waiver even when they ask for an unconditional one.',
    'It says what is at stake: an unconditional waiver gives up all your rights, and is usually signed only at the very end of a job, once you have 100% of what you asked for.',
    'Stay conditional, the blue button, changes nothing. Acknowledge and choose Unconditional, the red one, switches the form.',
  ],
}

export default note
