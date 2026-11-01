import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6261',
  date: '2026-11-02',
  title: 'Send a courtesy notice before a lien, from the Lien desk',
  kind: 'feature',
  highlights: [
    'A sent notice with nothing paid shows a new press from day 7: Send a courtesy notice. It sits on the Do now row and on the notice’s footer under Sent.',
    'The window names who gets it and how: the GC by email and by text when their card allows it, the owner of record by email when the property record has one. Change the greeting if you like, then press the counted button.',
    'The message says the notice stands, names the day the lien goes on unless the claim is paid, carries the pay link and the master plumber’s number, and never a joint check. The owner’s copy keeps the rule to pay only with the GC’s written okay.',
    'The desk holds the press, and says why, when the lien cannot go on: a homestead, no approved month, a closed window, or the affidavit due inside a week. Every press is recorded on the notice and in the job’s History.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
