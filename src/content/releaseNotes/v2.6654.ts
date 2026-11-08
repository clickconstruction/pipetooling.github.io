import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6654',
  date: '2026-11-07',
  title: 'The dev MCP reads the charged paper and a sub’s sheets too',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'An agent on the dev seat can now ask for a signed hours statement on the charged basis: every counted hour at the rate the customer is charged, as the crew it was part of, with the rate card, the job’s rule and the Charges window’s adjustments read as the window reads them. The reply names the rate, the words under the signature and the days the card could not price.',
    'A sub on a job’s sheets reads the sheets’ lines through the seat as well, one group a sheet with its payments, always as paid. Ask for the clock by name to read a sub’s own punches instead.',
    'A statement made through the seat keeps its basis, its rate and the words it was charged by on the row, as one saved from the window does.',
  ],
}

export default note
