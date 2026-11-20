import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8042',
  date: '2026-11-20',
  title: 'Job updates: the Reports and Billing pills show only to people who can read them',
  kind: 'fix',
  highlights: [
    'The pills over a job’s updates now follow what you can read on that job. A helper or a subcontractor sees All, Notes, Status and Crew, on one row on a phone.',
    'The office sees all six pills as before. A pill with nothing under it yet still shows dim for a person who can read that kind of line.',
    'A person who left a report on the job still gets the Reports pill with its count, and ＋ Report stays in its place on the job window.',
    'The same rule holds on the Job Mode card, the job window, Job activity on the Pipeline and a customer’s summary in Dispatch.',
  ],
}

export default note
