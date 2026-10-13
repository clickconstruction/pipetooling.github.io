import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5365',
  date: '2026-10-12',
  title: 'Job activity shows the customer’s calls, texts and emails',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Jobs → Pipeline, a job’s Job activity now numbers its calls, texts and emails from Messages with its notes, reports and status lines.',
    'The customer’s lines are orange, deeper when the customer sent them, and a small word says how each came.',
    'A new Customer pill shows only the customer’s lines. A line not tied to a job yet says so.',
    'Click a line to read all of it, a call’s summary included, and open the thread in Messages.',
  ],
}

export default note
