import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6599',
  date: '2026-11-06',
  title: 'A matter reads by theme: the investigation over its documents and events, on the Legal desk and the HR file',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A matter now has a By theme tab beside Narrative, Evidence and Timeline, on the Legal desk and on the HR file’s Matter view. Press a theme and the page holds only the documents and events that carry it, with the counts you tell counsel, oldest first or strongest first, narrowed by a grade or to the marks the agent proposed.',
    'Press an item to open it in a window over the list: the whole document line or event, the paper as a chip that opens it, every theme on it with why and how it proves it, Keep on a proposed mark, Take it off with a reason, Previous and Next through the theme. Open on the Timeline lands a paper on the Evidence tab and an event on the Timeline.',
    'Print this theme and Copy as a list for counsel work the same way they do on a person’s file. The tab is drawn only for a dev on an account with a matter; the office’s desk is unchanged.',
  ],
}

export default note
