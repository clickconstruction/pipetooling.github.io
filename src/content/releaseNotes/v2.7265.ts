import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7265',
  date: '2026-11-14',
  title: 'Moving a job’s materials on site now takes its name fixes, sticker runs, Same part? answers and prices too',
  kind: 'fix',
  highlights: [
    'When a whole job’s materials on site move to another job, through the dev seat or a job combine, the job’s part name fixes and the sticker runs printed for it now go with the boxes. Before, a name fix left behind could not be undone on the new job, and a run kept naming the old job.',
    'The job’s own Same part? answers and prices move too. Onto a job on no site they become that job’s; onto a job on a site they join the site’s answers, which every job on the site reads. When both sides had answered the same pair, the newer answer stands.',
    'The move’s plan and the note on both jobs name what went, and the move is refused when the counts after do not add up to the counts before.',
  ],
}

export default note
