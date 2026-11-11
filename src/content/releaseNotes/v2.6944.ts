import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6944',
  date: '2026-11-11',
  title: 'An agent on the dev seat can record sub labor on a job and what was paid against it',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now make a sub labor sheet on a job, as New Sub Labor does on Jobs → Subs → Pay. It names one subcontractor or primary, the day or the days, and the lines as flat amounts or hours at a rate. It can also change a sheet’s day or lines, move a sheet to another job, or remove a sheet that has no payment on it.',
    'When the days come from an outside record and not from a punch, the agent says so and names the record. Each line then ends with the word stated and the record’s name, so the mark shows wherever the line is read.',
    'The agent can record what was paid against a sheet, as Make Payment does, or take a payment off with a reason. The payment keeps its trace, and the app can undo the removal for 30 days.',
    'Before any change the agent reads a plan in words. It shows the job’s sub labor and profit before and after, and the sheets that person already has on the job. It warns when a bank row already counted on a job as cost would count the same dollars twice.',
  ],
}

export default note
