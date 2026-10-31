import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6136',
  date: '2026-10-30',
  title: 'Supply-house bills from a thread: name the sender, and a rep’s bill counts',
  kind: 'fix',
  highlights: [
    'Who is this? in Messages now finds supply houses and the people at them. Name an address that sends a house’s bills as the house or as one of its reps, and its PDFs get Record this bill.',
    'A bill from a supply house’s rep now counts in the house row’s bills to record, and it shows under Start from on the Add invoice window.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
