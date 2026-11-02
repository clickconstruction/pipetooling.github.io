import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6318',
  date: '2026-11-01',
  title: 'Postgres logs from the terminal work again on Supabase’s new logs endpoint',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The log reader the database freeze runbook points to when no Supabase connector is signed in stopped working when Supabase removed the endpoint it called. It reads the new endpoint now and prints the same lines: time, severity and message.',
    'The new endpoint reads only 24 hours from the start time, returns at most 1000 rows, and says nothing when it cuts a result. The reader now refuses a longer window or a bigger limit, and says so when the rows reach the limit.',
    'A refused call, a bad token or the rate limit shows as an error, never as no matching lines.',
  ],
}

export default note
