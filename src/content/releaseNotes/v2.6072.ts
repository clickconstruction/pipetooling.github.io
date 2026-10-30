import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6072',
  date: '2026-10-29',
  title: 'A checklist per stage: the rules (punch list #164, PR 1)',
  kind: 'feature',
  highlights: [
    'The rules behind the stage checklists are in place: Rough In, Top Out and Trim Set each get a short list of questions the office writes once, and the crew answers Yes, No or Not here on each job, with a note and a photo where a question asks for one.',
    'A stage reads not ready on the Pipeline until every question is answered. A stage kind with no questions written has no checklist and reads as it does today, so the checklists start the day the office types the questions.',
    'Nothing shows on a screen yet. The tables and the office’s editor come next, then the sheet on the phone, the Pipeline’s mark and the job’s Drive photos.',
  ],
  roles: ['dev'],
}

export default note
