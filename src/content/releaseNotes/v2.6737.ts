import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6737',
  date: '2026-11-08',
  title: 'The superintendent train’s walk slips, put right',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'superintendent'],
  highlights: [
    'New Job’s award block and the Costs strip read a bid with hours on its Labor rows as usable at the company rate from Settings → Line budgets when the bid has no rate of its own, the way the Labor tab reads it usable on the crew rate, and the award saves that rate on the bid. A bid with no Labor rows says so instead of “hours on 0 of 0 rows”, and the strip names the real reason instead of “sent without hours”.',
    'The planned finish counts a weekend award from the Monday after it, so a Sunday award at 241 hours reads Nov 23, not Nov 20. The Costs strip waits for the first clocked hour before judging a baseline heavy or light.',
    'The superintendent’s card names the office’s sign-off as the proof (“Signed off by the office at 25%”), calls the crew’s percent provisional only until the office signs it, and counts a sub’s sheet hours into the hours in, as the Scoreboard does. The Scoreboard’s Days column says “waits on hours” for a plan with nothing clocked yet.',
    'The owner’s weekly review window keeps the review it opened on after Looks right, and Clear is withheld on a baseline frozen at award, since the award is written once.',
  ],
}

export default note
