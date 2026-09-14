import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3401',
  date: '2026-09-14',
  title: 'Edit Job: add the job address as a property right from the Property record row',
  kind: 'fix',
  highlights: [
    'When a builder is entered as the customer, the Property record picker only listed the builder\'s office — there was no way to enter the legal address the lien paperwork needs. The row now offers "+ Add <job address> as a property on <customer>".',
    'One click opens the property sheet with the job address filled in; the county, legal description and owner of record are looked up on the appraisal roll, and Add property saves it on the customer and links the job to it.',
    'A saved property that already matches the job address is still offered to link, not added twice. The customer\'s primary address is never changed.',
  ],
}

export default note
