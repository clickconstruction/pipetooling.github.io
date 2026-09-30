import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4223',
  date: '2026-09-30',
  title: 'E2E smoke: the Settings tab check follows the Contracts & terms index',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The post-deploy smoke suite had been red on every run since Contracts & terms became an index: it still looked for the old section heading. It now looks for the index toolbar’s intro line, which only appears once the wording has loaded.',
    'Nothing changes on screen — the fix is in the check itself.',
  ],
}

export default note
