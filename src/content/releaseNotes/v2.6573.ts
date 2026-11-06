import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6573',
  date: '2026-11-06',
  title: 'The block editor adds a machine that is not on the fleet board yet, from its template, ours or a rental',
  kind: 'feature',
  roles: ['dev', 'assistant', 'controller', 'master_technician'],
  highlights: [
    'Add a machine on a block now ends with A machine not on the board yet. Pick the template first, and the line under it names the gauges and counts the stops the crew will fill in, so the office sees the check will match the machine.',
    'Ours takes the unit, make and model; Rental takes who it is from, the agreement number, make, model and the due-back day. One press puts the machine on the fleet board with that template and on the job’s day.',
    'The crew’s morning asks whether it arrived and opens the walk with that template’s gauges and questions, the same as a machine the board already knew.',
  ],
}

export default note
