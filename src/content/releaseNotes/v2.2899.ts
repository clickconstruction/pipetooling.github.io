import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2899',
  date: '2026-09-05',
  title: 'Banking tabs say what they are for, and Card Review can show card charges only',
  kind: 'fix',
  highlights: [
    'A caption row under the Banking tab strip spells out each tab — "User Sort — who spent it · Drag Sort — what kind · Reviews — read-only · Reconciliation — against bank statements" — and adds the one line people kept looking for: jobs are sorted in Job Parts Tally, labels live here.',
    'Card Review has a Kind filter. Its Unassigned row used to count transfers, payouts and fees as if they were unclaimed card charges; pick "Card charges only" and it shows only what someone actually swiped. Your choice sticks on this device.',
    'Reconciliation now says what it does: "Check against bank statements". The result reads "checked against bank statements … · not saved", and the page explains this is not the half-hourly sync that pulls new bank transactions in.',
    'Devs: if a Mercury account has no nickname it shows as a raw ID in every account filter — an amber line under the tabs now says which ones and opens the nickname list to fix it. Old Card Review links and saved preferences keep working.',
  ],
}

export default note
