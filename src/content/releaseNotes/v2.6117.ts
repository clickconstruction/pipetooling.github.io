import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6117',
  date: '2026-10-30',
  title: 'Job Parts Tally keeps one width across its three tabs',
  kind: 'fix',
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'dev', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone the Transactions, Materials Estimate and On site tabs no longer grow and shrink as each tab loads. The page took the width of whatever it was showing, so a tab with short lines drew narrower than the one before it.',
    'The page now holds its container’s width on every tab, and the three tabs share that full row from the first paint.',
    'On a desk the page is the same width it always was when a tab had enough to show; a tab with little in it now holds that width instead of pulling in.',
  ],
}

export default note
