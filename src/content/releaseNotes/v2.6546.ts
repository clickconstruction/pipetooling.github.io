import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6546',
  date: '2026-11-05',
  title: 'Mark a theme on an HR entry or a piece of evidence as you write it, on a line that stands, or on several lines at once',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Add entry and Add evidence on an HR file carry a Themes strip: press a theme, say why it fits in a few words, and press how it proves the theme (a document, their own words, a firsthand account or a relayed account).',
    'On the Timeline, + theme under a line marks one that stands already. Tick several lines and the bar at the bottom marks them all at once, naming the count.',
    'A Themes row above the line shows each theme with how many lines carry it; press one and the line shows only those. A mark comes off with a reason and its row stays. A mark the agent proposed is dashed until you keep it.',
  ],
}

export default note
