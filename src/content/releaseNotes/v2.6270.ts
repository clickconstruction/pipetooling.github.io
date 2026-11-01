import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6270',
  date: '2026-11-01',
  title: 'Documents → Photos: every photo uploaded, newest first',
  kind: 'feature',
  highlights: [
    'The Documents page has a Photos tab. Every photo taken on a report, a box on the Tally or a stage checklist is on it, newest first, grouped by day, with the job, the customer, who took it and the time.',
    'Each row says where the photo is: In Drive with a press to open it, On its way to Drive, Not in Drive yet with the reason, or Still on a phone. The Not in Drive yet chip counts the ones the office should look at.',
    'Type a job, a customer, a person or a stage to narrow the list. Pick a source. Press a picture to see it full size and move through the list; from there open it in Drive, open the report, the box or the thread, or open the job.',
    'The office and the estimator also see pictures that came in on a text or an email, with the sender named and the thread one press away.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
}

export default note
