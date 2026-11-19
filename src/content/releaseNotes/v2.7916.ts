import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7916',
  date: '2026-11-19',
  title: 'Lien desk: the copy you mail is the clerk’s stamped lien',
  kind: 'feature',
  highlights: [
    'Print the copies to mail now puts the clerk’s stamped lien in each envelope. It is the scan saved on the lien, with every page, the stamp, the signature and the seal. The page the app used to draw from its own record is gone. The cover letter and the mail sheet are the same.',
    'A lien with no stamped lien saved is held, and so is one whose saved copy the app cannot read or print. The line says why and where to fix it. The rest still print. Nothing prints in a stamped lien’s place.',
    'A saved copy of more than three pages is asked about before it prints, since it may hold other liens. The mail sheet now says how many pages each envelope takes.',
    'The print opens as one PDF in a new tab. The pages kept on each job are the same pages its envelopes took. A lien reads Print the copies to mail until its stamped copy is printed, whatever receipts it holds.',
  ],
}

export default note
