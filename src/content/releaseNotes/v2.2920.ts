import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2920',
  date: '2026-09-06',
  title: 'Role sweep — controllers reach the bank data their screen shows, primaries see their assigned stages, estimators lose a People door they were never meant to have',
  kind: 'fix',
  highlights: [
    'Controllers: Banking now works like it does for an assistant — the queues fill, splits and labels save, the Balance Sheet cash line and Reconciliation load — and a job opens the full Job · Edit · Bill window with the + Create Job link. Before, the screen admitted controllers while the bank data and job records refused them.',
    'Robot audits: the Needs-You card, the Bids 🤖 tab and the audit controls now agree on who is an auditor (owner, master, assistant, controller, estimator) — nobody is shown a door they cannot finish.',
    'Primaries assigned to a workflow stage can now see it (Dashboard → Assigned Stages was always empty); controllers can be added as a roster kind on People → Users; superintendents can only create a sub sheet for a work order on their own jobs.',
    'Estimators no longer see People in the nav or reach /people — the access matrix always said no; the route and the link now agree.',
  ],
}

export default note
