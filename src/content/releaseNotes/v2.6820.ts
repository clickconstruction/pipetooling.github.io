import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6820',
  date: '2026-11-09',
  title: "What a person signed is one press and one door away on their HR file",
  kind: 'feature',
  highlights: [
    "On People → HR the strip's chips are now presses. Press 1 paper signed and the Timeline narrows to that person's papers; press it again for the whole record. Every chip works the same way: licenses, write-ups, evidence, HR entries.",
    'A signed paper\'s line opens its own signed record on People → Contracts, with the agreement\'s words and the signing\'s facts, instead of the whole Contracts tab. The line also says how it was signed and when the office recorded it when that was later.',
    "A person's hours statements are on the Timeline too, each saying where it stands: a draft, printed and not signed back, sent for signature, or signed back. The line opens the signed record, the file in Drive, or the job that holds the sheet.",
    "An agent reading a person's file through the dev seat gets the same papers and statements as short lists: the paper, the day, who signed, how, where it stands, and the door to the record.",
  ],
}

export default note
