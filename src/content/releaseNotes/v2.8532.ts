import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8532',
  date: '2026-11-24',
  title: 'Global Reload: only a dev can send it',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Only a dev can now make every open copy of the app reload. The database checks who sent the signal.',
    'Before, the check was only on the screen. Anyone who knew how could have sent the signal from outside the app.',
    'Everyone who is signed in still hears the signal. Nothing changes for the press in Settings, under Advanced.',
    'A copy of the app that has not updated yet does not hear a signal sent from an updated one. It updates by itself at a quiet moment.',
  ],
}

export default note
