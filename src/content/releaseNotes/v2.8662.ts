import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8662',
  date: '2026-11-26',
  title: 'A check that came back keeps its lien releases held after the payment is taken off',
  kind: 'feature',
  highlights: [
    'In Accounts Receivable, a check that came back on a liened job now has one press under Liens on this money. It reads like Hold 2 releases on the Lien desk. It marks each saved release with the check and the day it came back.',
    'The Lien desk used to forget once the payment was taken off the job. A marked release now keeps reading Do not record it in Payoffs, on the Release of record tab and in the run, where it does not print.',
    'A recorded release that is marked keeps reading Released, money came back.',
    'Nobody takes the mark off. A release is let go when its bills read paid by a later payment that has cleared.',
  ],
}

export default note
