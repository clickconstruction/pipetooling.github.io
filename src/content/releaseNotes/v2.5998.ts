import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5998',
  date: '2026-10-27',
  title: 'Punch-list numbers are claimed, not derived',
  kind: 'infra',
  highlights: [
    'A session writing a new punch-list card reserves its number with one command, the same way it reserves a version, so two sessions working at once can no longer take the same number.',
    'The to-do check prints the next free number past every number another session holds, and names the command that reserves it.',
    'The sessions board lists the held punch-list numbers, the open PRs writing a new card, and any two that collide.',
  ],
}

export default note
