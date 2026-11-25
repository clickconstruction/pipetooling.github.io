import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8582',
  date: '2026-11-25',
  title: 'A slow reload no longer shows the sign-in page to someone who is signed in',
  kind: 'fix',
  highlights: [
    'On a slow phone, a reload could show the sign-in page for a moment to a person who was signed in the whole time.',
    'It then opened the Dashboard, not the page the person was on.',
    'The app now keeps a sign-in it has already been told about, so the reload opens the same page.',
    'When the app truly hears of no sign-in in 8 seconds, it still shows the sign-in page, as before.',
  ],
}

export default note
