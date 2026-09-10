import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3232',
  date: '2026-09-10',
  title: 'Robot asks written before the one-decision rule go to the owner, split into taps',
  kind: 'fix',
  highlights: [
    'A robot question that bundles several decisions no longer sits on Standing rulings as a wall of text. The panel says one is waiting for the owner, and it moves to Robots → Console as an owner memo.',
    'The memo shows the robot’s full text and the decisions split out as editable one-tap drafts. Post puts them on Standing rulings as the robot’s own questions with buttons, and retires the original with a note saying where they went.',
    'Dismiss no longer claims the robots will re-ask on their own. They ask again only when a run needs that decision.',
  ],
}

export default note
