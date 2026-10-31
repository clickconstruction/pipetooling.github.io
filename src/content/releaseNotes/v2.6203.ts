import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6203',
  date: '2026-10-30',
  title: 'Linked crews on Schedule & Dispatch read in dark mode',
  kind: 'fix',
  highlights: [
    'With Highlight linked on, half the crew colours drew a light card in dark mode under light words, so the job, address and time almost disappeared.',
    'Every crew card now takes a deep tint of its colour in dark mode, and its words read clearly.',
    'Light mode looks exactly as before.',
  ],
}

export default note
