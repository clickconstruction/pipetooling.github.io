import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7914',
  date: '2026-11-19',
  title: 'A primary’s report email follows their own jobs',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A primary sees only the reports on their own jobs in the app. Their email now follows the same rule.',
    'A primary you add to Email reports gets a report when they are the job’s account manager or its listed superintendent, or when they wrote it. Every other report is left out of their email and their digest.',
    'Their digest lists crew hours, clock notes and costs only for the jobs they manage or superintend.',
    'Send now says how many reports it left out for this reason. It is the same when you type a primary’s own address. Everyone else gets what they got before.',
  ],
}

export default note
