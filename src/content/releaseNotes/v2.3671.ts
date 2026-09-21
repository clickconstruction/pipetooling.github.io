import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3671',
  date: '2026-09-21',
  title: 'Materials by stage, PR 1: the rules, the storage and the factor',
  kind: 'feature',
  highlights: [
    'Groundwork for the schedule of values Wendi asked for: every fixture or tie-in on a takeoff can carry a stage (1 Rough In, 2 Top Out, 3 Trim Set, or a split), any part line under it can carry its own, and so can a single part inside an assembly. The boxes arrive on the Sheet in the next release.',
    'The rules that will fill the stages for you are pinned to the page Wendi marked by hand: waste pipe half below the slab and half above, water and gas in the wall, drains and cleanouts and interceptors below the slab, valves and arrestors in the wall, set fixtures at trim.',
    'Settings → Templates & testing → Bid Cover Letter Defaults gains the schedule of values factor (1.5): each stage’s raw material times this number is the figure on the schedule. A bid will be able to use its own.',
  ],
}

export default note
