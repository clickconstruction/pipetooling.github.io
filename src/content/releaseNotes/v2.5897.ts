import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5897',
  date: '2026-10-26',
  title: 'Help: the app counts which guides are opened, and through which door',
  kind: 'feature',
  highlights: [
    'Every time a guide opens, the app records which one and how it was reached: the Help list, its search, a link on a page, a walkthrough or a share page.',
    'Settings → Usage gains a Guides panel: the guides opened most, by role and by door, how many of the guides nobody opened in the window, and any link that points at a guide that no longer exists.',
    'Nothing typed in the search box is recorded, only the guide that opened.',
  ],
}

export default note
