import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7602',
  date: '2026-11-17',
  title: 'Checklist: the ⋮ menu on Manage stays open on a scrolled list',
  kind: 'fix',
  highlights: [
    'On Checklist, Manage, the ⋮ menu of a task now stays open when you have scrolled down the list.',
    'It used to open and shut at once on any task below the top of the page, so Edit, Mute notifications and Delete could not be reached there.',
    'The menu still closes when you scroll the page or press outside it.',
  ],
}

export default note
