import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8066',
  date: '2026-11-20',
  title: 'Document builder: a draft that did not save says so, and a save that lands after you leave is kept',
  kind: 'fix',
  highlights: [
    'When a draft does not save, the bar now reads Draft not saved in red, with the reason below it. It used to read Draft saved.',
    'A draft that did not save is sent again when you type again, and when you leave the builder.',
    'Words typed on the Sub NDA just before you press back are there when you open it again. They used to be missing, and the next typing saved over them.',
  ],
}

export default note
