import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3596',
  date: '2026-09-18',
  title: 'Labor books: the human books fold into Robot Default, and every entry remembers where its hours came from',
  kind: 'infra',
  highlights: [
    "The old Default and Bill labor books folded into their trade's 🤖 Robot Default: matching entries merged their aliases, the three that disagreed kept the robot's split (same total hours, the office's version noted on the entry), and the rows only the human books had were added. Bryan and default, both empty, are gone. BP83 now prices on the robot book.",
    'Each entry now records whether a robot or a person set its hours, and a robot re-seed never overwrites a number a person set. The screens that show this arrive in the next release.',
  ],
}

export default note
