import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2325',
  date: '2026-08-26',
  title: 'Superintendent navigation works everywhere it should',
  kind: 'fix',
  highlights: [
    'Superintendents now see Estimates, Jobs, and Bids in the top navigation, and Documents in the gear menu — pages they always had access to but had no way to reach.',
    'Removed the icons and the Dispatch Mode toggle that bounced superintendents back to the dashboard when tapped.',
    'Links into a specific estimate, workflow, or statement now open correctly for field roles instead of kicking back to the dashboard.',
    'Pinning a page for someone whose role can\'t open it is now refused with a clear message instead of leaving them a dead pin.',
  ],
}

export default note
