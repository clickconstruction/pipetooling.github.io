import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6867',
  date: '2026-11-10',
  title: 'Lien desk: one press redraws every ready affidavit on the short form',
  kind: 'feature',
  highlights: [
    'The Affidavits list has a new press at its top, like Redraw 12 on the short form… It shows while a ready affidavit is still on the earlier form.',
    'The press asks once. Then each ready affidavit goes back to To draft on the short form, and each needs approval again before it is filed.',
    'An affidavit waiting on the leader, held by him or still a draft is left where it is. Redraw one of those from its own paper.',
    'If a paper cannot be redrawn, the rest still are. The one that did not take stays listed under the press with its reason.',
  ],
}

export default note
