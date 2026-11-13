import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7110',
  date: '2026-11-12',
  title: 'Supply houses: one list of the bills whose lines need a person',
  kind: 'feature',
  highlights: [
    'Materials → Supply houses has a new line under Accounts payable: how many bills have their lines read, how many add up and how many need a person.',
    '**Show the 47** opens *Bill lines*: each reason a bill waits, how many bills, and what opens it. A reason opens to its bills.',
    '**Look** opens the paper beside its lines when a sum is off. **Open the bill** opens the bill itself when its link, its number or its amount is wrong.',
    'A statement and a read the app will try again are listed with nothing to press, because there is nothing to do.',
  ],
}

export default note
