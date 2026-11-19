import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7906',
  date: '2026-11-19',
  title: 'A primary sees the reports on their own jobs',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A primary used to see every field report in the company. Now a primary sees a report when they are the job’s account manager or its listed superintendent.',
    'A primary still sees every report they wrote, on any job. Settings, My reports is unchanged.',
    'The Dashboard’s Recent Reports card and Jobs, Reports list only those reports. The new count and Mark opened count only those too. A line over the list says whose reports it holds.',
    'The rule holds for a report’s photos as well. Everyone else sees reports as before.',
  ],
}

export default note
