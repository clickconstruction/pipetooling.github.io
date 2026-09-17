import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3537',
  date: '2026-09-16',
  title: 'Pipeline: the partial-invoice rule is written down once',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. What "Create partial invoice" does with the amount you type — clamp it to what is left, hand the whole remainder to Bill Customer, or add a new line and re-sync the draft — is now one tested function, and the dialog lives in its own file.',
  ],
}

export default note
