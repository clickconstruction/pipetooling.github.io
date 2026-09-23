import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3776',
  date: '2026-09-23',
  title: 'Lien desk: the bar under the notice is one row',
  kind: 'feature',
  highlights: [
    'The bar under a draft notice said the same thing three times — a headline, a sentence repeating it, and routing news about a send that could not happen yet — and took four rows to do it. It is now one row: the state and its verb on the left (Owner of record missing · Go to gate 1; Goes to the leader · first notice to this GC · Send for approval), Save draft and a quiet Skip on the right.',
    'Who the notice goes to — the owner of record and the GC by certified mail, the courtesy PDF — and the Include the cover note switch now sit on one line above the paper they describe.',
    'Skip is a small link beside Save draft; clicking it still says the cost — skipping gives up the lien right on those months — and still refuses without a reason. Nothing it dropped is gone: every fact is on the gate cards or the months card one glance up.',
    'The leader’s approval bar is the same one row. On a phone the bar is two lines instead of six.',
  ],
}

export default note
