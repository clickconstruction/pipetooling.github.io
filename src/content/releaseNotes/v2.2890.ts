import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2890',
  date: '2026-09-05',
  title: 'Every hand-off lands on its station',
  kind: 'fix',
  highlights: [
    'Quickfill sections now have an address: a link to a section opens it and scrolls straight there instead of landing at the top of the page. If the section is hidden for you, a short note says so.',
    'Needs You → "Match deposits" opens Accounts Receivable right over the card, so you keep your place on the Dashboard or Quickfill. The Accounts Receivable page itself now has a real Back button.',
    'Moneyfill has a "See the week\'s report" button that opens the Weekly Money Movement report on the week you were closing.',
    'Four wrong landings fixed: "Someone tried to become a dev" opens the code form on Settings → Advanced; Settings search "Page pins" lands on Your dashboard; Edit Job works from a Job Summary link instead of saying "wait until jobs finish loading" forever; a Day-view schedule link opens the linked day, not today.',
  ],
}

export default note
