import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7184',
  date: '2026-11-13',
  title: 'Pipeline on a phone: the lien chip names the next step',
  kind: 'fix',
  highlights: [
    'On a phone, a billed row’s lien chip now names the next step and the days left: Find the owner · 4 d, Draft the affidavit · 12 d, Answer the homestead question · 9 d. It read lien in 4 d whatever the step was.',
    'The words are the ones the same row uses on a computer, so the phone and the desk no longer say two things about one job.',
    'A notice window that closed while a late notice can still go reads Send the late notice. It read lien gone.',
    'A tap opens the Lien window on the tab of the paper the chip names. A long step takes two lines in the chip, so the job’s name keeps its room.',
  ],
}

export default note
