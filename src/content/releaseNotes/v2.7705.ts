import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7705',
  date: '2026-11-17',
  title: 'Lien notices: a mail number for each envelope when you record a notice already mailed',
  kind: 'fix',
  highlights: [
    'A notice goes to the owner of record and to the original contractor in two envelopes, and each envelope has its own certified label. Already mailed? Record it… had one Tracking box and wrote that one number on both. It now shows a box for each recipient when the paper went by certified mail or a courier.',
    'Each certified number is checked as you type it, the way the run window checks it. A line says so when both boxes hold the same number. Neither stops the record, and a box left empty reads as tracking owed until you add the number.',
    'A certified mail number has 20 or 22 digits, by the label. The divider page of a notice run and the hint under a number box now say both lengths. They used to say 20, and the labels bought at the counter carry 22.',
    'Mail, email and hand delivery keep their one box. Notices already on record are not changed by this.',
  ],
}

export default note
