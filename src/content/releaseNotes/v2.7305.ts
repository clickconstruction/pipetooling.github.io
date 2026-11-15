import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7305',
  date: '2026-11-15',
  title: 'Move everything on site to another job',
  kind: 'feature',
  highlights: [
    'A count started under the wrong job can now be moved whole from the office. Under a job’s boxes on Materials, press Move everything on site to another job… and pick the job the material belongs on. The jobs on the same site are offered first.',
    'Read the plan shows what would move before anything does: the cages and boxes, the presses on the ledger, the photos, each job’s boxes and parts before and after, and any place or stencil that becomes one with the other job’s. The button then names the move with its counts, such as Move 92 boxes and 284 presses to JP1091.',
    'Every box keeps its code, its label and its history. Only the job it sits under changes. The box photos’ files follow to the other job’s Drive folder by themselves, and a note lands on both jobs.',
    'The press is for a dev, a master technician, an assistant or a controller, the people who may combine two jobs. The Materials desk offers it on a site row too, when two of the site’s jobs hold boxes.',
  ],
}

export default note
