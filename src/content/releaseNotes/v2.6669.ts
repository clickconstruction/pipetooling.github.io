import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6669',
  date: '2026-11-07',
  title: 'The courtesy notice’s loose ends: a failed record never resends, the clock reads the delivery day, the GC’s grey line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When a courtesy notice’s messages went but the record could not be written, the window now closes and the footer says what went and why the record failed. Its button, Write the record again, writes the record alone, so nothing is ever sent a second time.',
    'The attorney’s letter’s clock, and the courtesy’s day 7 with it, now counts from the day the first packet was delivered, or the day USPS accepted it, whenever the Docsmit piece knows, as the guide has promised since the Docsmit train. The Dashboard’s lien month reads the same clock.',
    'The GC’s Messages thread shows the courtesy notice as a grey line from the office, as the owner’s already did, so a reply to it goes to the office.',
    'The guide now says the amount a courtesy names is what the job’s bills still owe today, and that a reply in Messages does not close the reminder by itself yet.',
  ],
}

export default note
