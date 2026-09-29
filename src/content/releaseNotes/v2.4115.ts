import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4115',
  date: '2026-09-28',
  title: 'My Time day editor: Save is all or nothing',
  kind: 'fix',
  highlights: [
    'Saving a day in the day editor used to send each change on its own. If one was refused part-way, the changes before it stayed saved and the rest were not — leaving the day half-edited.',
    'Now the whole day is saved in one step: either every change is saved, or none is and the day stays exactly as it was.',
    'Payroll hours for the day are recounted in that same step when approved times change.',
  ],
}

export default note
