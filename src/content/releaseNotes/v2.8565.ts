import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8565',
  date: '2026-11-24',
  title: 'Card and footer: the developer can remove a test person’s photo',
  kind: 'feature',
  highlights: [
    'On Card and footer, the developer now reads Remove the photo… under the photo’s press. Nobody else sees it.',
    'It removes a test person’s photo only: the name starts with ZZ. A real person’s photo stays, and the card says why.',
    'The photo comes off the card and the footer, and its file is deleted. The window that asks first has a button that reads Remove the photo.',
    'For everyone else the card works as it did: a photo is added and changed.',
  ],
}

export default note
