import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6269',
  date: '2026-11-02',
  title: 'The courtesy notice shows wherever the notice does',
  kind: 'feature',
  highlights: [
    'A sent courtesy notice is a square stop on the job’s lien timeline, after the notice and before the affidavit: the day it went, by email or text, who pressed, and the lien day it named. The Lien desk, the job’s Lien window and the Legal desk draw it.',
    'The Legal desk’s Paper tab and the firm’s page read a Courtesy notice line under each notice, beside letter two and the owner’s answers.',
    'The GC’s and the owner’s Messages threads show the courtesy notice as a grey line from the office, so a reply to it goes to the office like a reply to the notice.',
    'An owner’s portal card says the reminder reached them by email, and that the notice stands. The Accounts Receivable lien chip reads Courtesy notice on a row where one is due.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
