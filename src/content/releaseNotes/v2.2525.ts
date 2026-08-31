import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2525',
  date: '2026-08-31',
  title: 'The app is named ClickTooling everywhere it introduces itself',
  kind: 'fix',
  highlights: [
    'Adding the app to your phone\'s home screen now suggests "ClickTooling" instead of the old PipeTooling name — re-add the icon if yours still shows the old one.',
    'The browser tab, link previews when you text a job link, and push notifications now say ClickTooling too.',
  ],
}

export default note
