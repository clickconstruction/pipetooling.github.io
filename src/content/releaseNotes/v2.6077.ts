import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6077',
  date: '2026-10-29',
  title: 'Stage checklists: the office writes the questions (punch list #164, PR 2)',
  kind: 'feature',
  highlights: [
    'Settings → Jobs & billing has a new card, Stage checklists. The office types a short list of questions for Rough In, Top Out and Trim Set, once for the company, and ticks the ones that ask for a photo.',
    'The card ships empty. The stage checklists start the day the office types the questions; until then every stage reads as it does today.',
    'The crew’s sheet on the phone, the Pipeline’s not-ready mark and the job’s Drive photos come in the next three releases.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
