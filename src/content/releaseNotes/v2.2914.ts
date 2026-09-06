import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2914',
  date: '2026-09-05',
  title: 'Job Summary’s footer says what it hides; partner screens stop promising an acknowledgment step that’s gone',
  kind: 'fix',
  highlights: [
    'Jobs → Job Summary: the footer under the table now reads "417 shown · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor — show all" instead of "Showing 417 of 417 jobs after filter", which could never count the legacy jobs the floor removes. The control is labelled in plain words ("Hide older imported jobs with HCP # at or below …") and "show all" drops the floor in one click.',
    'Partnerships: the Deal tab’s Weekly statement row, the Statements tab’s close card, and the Timeline’s statement rows no longer speak of a "mutual acknowledgment" or "no acknowledgments yet" — the partner’s acknowledge button was retired in v2.2212. They now say the statement is posted to the partner’s statement page; a week acknowledged back when the button existed keeps its "acknowledged by both" stamp.',
    'Partner statement letterhead: while the deal is still a draft, it reads "draft since Mar 22, 2026" rather than "partner since" — the paper no longer asserts a partnership the Agreements tab says isn’t signed yet.',
  ],
}

export default note
