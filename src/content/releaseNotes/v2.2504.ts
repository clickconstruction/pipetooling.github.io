import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2504',
  date: '2026-08-30',
  title: 'The placement engine — robots can now draw the takeoff',
  kind: 'feature',
  highlights: [
    'A tested coordinate kernel + assembler turns an agent\'s plan reading into a valid CountTooling takeoff, with a counts-vs-schedule self-check before anything imports.',
    'Plan-set sweep and tiling automation renders whole sets and drawing grids in single commands.',
    'Calibrated against 205 human takeoffs (median 51 marks + 57 lines), and mission M4 — the twin does the LIVSTE takeoff itself — is live.',
  ],
}

export default note
