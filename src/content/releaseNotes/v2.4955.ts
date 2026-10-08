import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4955',
  date: '2026-10-08',
  title: 'Lien window tests: the § Rules case no longer times out under load',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a test of the Lien window’s § Rules door timed out three times on a busy machine. It passed on its own.',
    'The rules window is a large chunk that carries every help guide. The test loaded it inside its own five-second clock, and under a full run that load alone could take longer.',
    'The test file now loads the chunk once, before any case starts, and the case waits for the window’s timeline before it presses the door.',
    'Nothing changes on screen.',
  ],
}

export default note
