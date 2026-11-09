import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6740',
  date: '2026-11-08',
  title: 'Materials on site: the Procure step opens the job’s cages and boxes',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a bid’s Procure step, once the bid is a job, a line under the four steps says where the parts marked delivered sit now, by cage and box, and what walked away, and Materials on site opens the job’s materials page.',
    'Before anything is marked delivered the line still offers the door, so a job that started from a first count is one press away.',
    'The materials desk guide names the door.',
  ],
}

export default note
