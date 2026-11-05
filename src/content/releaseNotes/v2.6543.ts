import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6543',
  date: '2026-11-05',
  title: 'An HR file can carry a matter: the analysis for counsel on a person, with the narrative, the documents and the timeline',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'People → HR gains a Matter view beside Timeline, Evidence and Narrative. Open a matter… makes a legal matter that stands on the person, the way the Legal desk’s matters stand on a Collections payer.',
    'The matter has the desk’s three pieces: the narrative for the firm, the documents with what each one shows, and the timeline of planned steps and recorded events, each with the same presses the desk has. The account tabs, who owes and the lien paper, are not drawn: there is no payer.',
    'A matter on a person is a dev’s record, like the HR file it hangs on. The office roles that read the desk’s account matters never see it.',
  ],
}

export default note
