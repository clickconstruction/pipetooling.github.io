import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2601',
  date: '2026-09-01',
  title: 'Send Job Back understands "stage billed, work continues"',
  kind: 'feature',
  highlights: [
    'Sending a job back to Working after billing a stage no longer reads like an incident: the confirm now says your billed line stays billed and the auto-remainder draft comes back on its own.',
    'The "I am going to call the Subcontractor…" checkbox only appears when the send-back would actually delete a draft bill you created on purpose.',
    'One-tap reason chips — "Stage billed — continuing work" / "Rework needed" — fill the crew-visible note without typing.',
  ],
}

export default note
