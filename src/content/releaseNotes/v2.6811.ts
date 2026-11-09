import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6811',
  date: '2026-11-09',
  title: 'The dev seat says a new job starts at Working',
  kind: 'fix',
  highlights: [
    'A job made from the MCP seat lands at Working on the Pipeline, where New Job puts one. The plan and the reply after used to say Waiting. They now name Working, so what the seat says matches what the Pipeline shows.',
    'Nothing about the job itself changed, and the jobs already made from the seat are where they should be.',
  ],
}

export default note
