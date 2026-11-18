import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7831',
  date: '2026-11-18',
  title: 'New Job from a won bid: bring the price over as stages',
  kind: 'feature',
  highlights: [
    'When you open a job from a won bid, one window now asks how the price comes onto the job: as stages, as one line, or start at $0.',
    'As stages brings a line for Rough In, Top Out, Trim Set and Final, adding up to the price. Chips pick 30/30/30/10 or 40/40/20.',
    'Each stage carries its hours from the bid’s Labor tab, so the pace card and the Projects board can draw the job stage by stage.',
    'Nothing is saved until you press Create Job, and every line arrives Any time, so billing works as before.',
  ],
}

export default note
