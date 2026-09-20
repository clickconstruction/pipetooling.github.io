import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3635',
  date: '2026-09-20',
  title: 'What customers see: the agreement PDF email has its own step, and a paper hand-off reads as one',
  kind: 'feature',
  highlights: [
    'Settings → What customers see: the homeowner\'s agreement lane gains Agreement PDF — the email that carries the agreement to print and sign by hand — rendered by the same code that sends it.',
    'On a real customer\'s strip, the lane follows how the agreement actually went out: PDF emailed · waiting for the signed copy, or Handed over on paper, each with a File the signed copy door. It no longer says a link was "never opened" when no link was sent.',
  ],
}

export default note
