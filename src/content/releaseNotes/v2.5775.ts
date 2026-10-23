import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5775',
  date: '2026-10-23',
  title: 'Quickfill: Fill them in takes the vehicles missing a record',
  kind: 'feature',
  roles: ['assistant', 'controller', 'dev'],
  highlights: [
    'The Fill them in deck on Quickfill’s Needs you station now walks the vehicles with no insurance, registration or service on file, one truck at a time, asking only for the record that is missing.',
    'Insurance asks the plan when the truck is off one, and the cost in the unit the carrier quotes. Registration asks its cost the same way. Service asks what was done, the day, the miles and a note, like Log service on People → Vehicles.',
    'Save and next writes exactly what the Vehicles tab writes, so Review prices the truck from it at once. Undo takes it back. The vehicles line’s button now reads Fill them in.',
  ],
}

export default note
