import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4104',
  date: '2026-09-28',
  title: 'The job cost timeline shows fuel by day, and counts card charges right',
  kind: 'fix',
  highlights: [
    'On a job’s cost timeline, fuel card charges are their own ⛽ Fuel line, on the day each was bought — so on a long job you can see when fuel landed on it.',
    'The timeline, daily spend and “spent so far” now count card charges the way the job’s parts cost does: a refund comes off, a transfer between accounts is not a cost, and a charge already on a supply-house invoice counts once.',
  ],
}

export default note
