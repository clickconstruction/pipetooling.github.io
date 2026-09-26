import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3852',
  date: '2026-09-26',
  title: 'Render smokes settle before they assert: one helper, one rule',
  kind: 'fix',
  highlights: [
    'Three component smoke tests went red in six days on branches that never touched them, each because the test read or clicked the moment the component first painted, before its effects and lazy panes had settled. One of them knocked two unrelated pull requests out of the merge queue.',
    'The test harness now offers one way to wait for the state a data load produces before reading it, and the three tests that were each fixed their own way use it. The rule is written where the next test author will see it.',
    'Nothing in the app changed; this only makes the checks that guard every pull request stop failing on a busy machine.',
  ],
}

export default note
