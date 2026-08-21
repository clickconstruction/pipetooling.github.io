import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2041',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Customer statement: trade-first job lines',
  highlights: [
    'Statement rows now lead with the trade in its company color — PLUM, ELEC, or HVAC — then the job number and the street: "HVAC 978 • 415 Springtown Way", with the city on the quiet second line.',
    'The trade colors are the same ones the crew sees on the Pipeline board, so a statement and a job read as the same thing.',
    'Jobs with no trade on file show number-only; jobs with no address fall back to their name — nothing renders blank.',
  ],
}

export default note
