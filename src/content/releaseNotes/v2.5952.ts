import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5952',
  date: '2026-10-26',
  title: 'People, Payroll and Hiring: an empty list names the next press',
  kind: 'feature',
  highlights: [
    'On People → Users an empty group says No estimators yet. + Hire adds the first, and that + Hire opens the form with the group’s Kind picked. People → Subs offers the same + Hire.',
    'A search with no match on Users, Contracts, Employment, Payroll, Offsets, Vehicles, Hours, Review and Feedback quotes what you typed and offers Clear the search. A filter chip that hides everyone offers Everyone or All.',
    'Licenses, Vehicles, Due by Team, the Payroll forecast and the Hiring board offer their own button when empty: + Add license, + Add Vehicle, Add team, + Add bar, + Add candidate, or the stage the cards come from.',
    'Where empty is the good state it says so, like Nothing waiting on you or Nothing expires in the next 30 days. Who’s where, the Day book, Spending and the calling report offer the week or month before.',
  ],
}

export default note
