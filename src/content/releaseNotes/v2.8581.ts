import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8581',
  date: '2026-11-25',
  title: 'A person’s desk on a phone gives its sections the screen, and the short Dashboard waits for its counts',
  kind: 'fix',
  highlights: [
    'A link to one section of a person’s desk now lands on that section. Before, it could stop one swipe short while the sections above it loaded.',
    'On a phone, the desk’s notices and presses scroll away with the page. The person’s name and the × stay at the top.',
    'On the short Dashboard, the line about the office and the count on Everything else now wait until the list is read. Before, they showed wrong numbers for a few seconds.',
  ],
}

export default note
