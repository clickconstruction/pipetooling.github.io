import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8639',
  date: '2026-11-26',
  title: 'Accounts Receivable: a check that comes back knows its lien releases',
  kind: 'feature',
  highlights: [
    'A check that came back on a job with a filed lien now shows a box named Liens on this money in its case. Each lien says where its release stands: none has left, one was printed and reads Do not record, or the county recorded one.',
    'A printed release names the day it was printed and who printed it, so the paper can be found and kept back. A recorded release reads Released, money came back, and tells you to ask counsel.',
    'A check typed once in Payoffs over several bills is found by its check number, so its jobs show in the case too. Each such job says to take the payment off on its Bill tab.',
    'In Payoffs and on the Release of record tab, a saved release whose check came back reads Do not record. A recorded one stays in the open list in red, out of the Released fold.',
  ],
}

export default note
