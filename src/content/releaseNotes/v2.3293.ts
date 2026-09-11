import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3293',
  date: '2026-09-11',
  title: 'The Legal desk: review a Collections account the way an attorney would receive it',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline → Collections has a ⚖ Legal button. It opens one account at a time — the payer and every Collections job they owe on — with the five sections a law firm would get: Account, Paper, Their word, Evidence, Fees & steps.',
    'The top of each account says what an attorney could plead today (signed contract · sworn account · lien only · none yet), what Click would keep after a firm\'s third and a filing cost, and what on record argues against pursuing. The rail sorts by what Click keeps.',
    '"Before this goes to an attorney" lists the fixes an attorney asks for first and the notes worth knowing — the lien clock per job, a demand letter that hasn\'t gone out, an incomplete property record — each with a button to the surface that owns the record.',
    'Their word is one timeline — contacts logged on the customer, promises and whether they were kept, collection calls, the collections note — with entries before the first bill held back from counsel by default. Print packet gives the cover sheet and exhibits; Write down… opens the agreed write-down for accounts not worth pursuing. Marking an account attorney-ready comes next.',
  ],
}

export default note
