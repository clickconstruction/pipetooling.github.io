import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8336',
  date: '2026-11-23',
  title: 'Dashboard: the Today’s sends row shows the texts',
  kind: 'feature',
  highlights: [
    'The Needs you row for Today’s sends now reads like 3 texts to send, with the names the texts go to under it. It used to be a title and a line of counts.',
    'The count is the texts you can send now. A text set to go at a time shows as a chip with its time, and a held text as a chip with why it is held.',
    'With one text waiting, the row shows the text itself. When no text can go, the row names each person with the cause.',
    'The press reads Read them. It opens the list and sends nothing.',
  ],
}

export default note
