import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4267',
  date: '2026-09-30',
  title: 'Deploys: a run that stalls now fails and the next one takes its place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every job in the deploy workflow carries a time limit, and the browser install that draws the help share cards has its own short one, so a hung step ends the run instead of holding the site on an old build.',
    'On the afternoon of 30 September one deploy sat on that step for four and a half hours; because only one deploy runs at a time, every merge behind it was dropped and nothing reached the site until the run was cancelled by hand.',
    'The pull-request check job carries the same limit, so a stuck check fails rather than waiting forever.',
  ],
}

export default note
