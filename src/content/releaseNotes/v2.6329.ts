import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6329',
  date: '2026-11-02',
  title: 'A job’s kind: service call or project, read from the job’s own facts and settled by one press',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Every job now has a kind. A service call is priced by the work and billed at the end; a project is priced before it starts and moves only by change orders. The job window shows it as a chip beside the name, and every Pipeline row carries it, on a phone too.',
    'New Job asks it as two presses under the job’s numbers, Service call or Project, already pressed when the facts settle it, with the reason under them: a bid behind the job, a GC project, Stage Plan rows, a price before any work, or an HCP number alone. Press the other side if that is wrong, and your press is saved with the job. Press nothing and the app keeps reading the job’s facts.',
    'Edit Job carries the same two presses. A press saves at once and wins from then on; nothing the app reads later changes it back.',
    'The Pipeline’s ⋯ tools menu gains a kind filter, Projects, Service calls or Kind not set, each with its count, and the search bar names it as a chip. Guide: say whether a job is a service call or a project.',
  ],
}

export default note
