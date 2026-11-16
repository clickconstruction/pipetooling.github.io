import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7402',
  date: '2026-11-15',
  title: 'Job window: Subs on this job (sub labor train)',
  kind: 'feature',
  highlights: [
    'The Costs tab of a job’s window now shows Subs on this job: each person the job’s sub sheets are owed to, their sheets, and what is still open, with a check that it adds up.',
    'A teammate with a sheet of their own on the job is listed too, with a Team · sub labor chip.',
    'A sheet opens on Jobs → Subs → Pay and a name opens that person’s row on People → Subs.',
    'An amber line warns when two sheets of the job carry the same line and amount, so the same work is not owed twice.',
  ],
}

export default note
