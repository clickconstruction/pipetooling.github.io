import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5792',
  date: '2026-10-23',
  title: 'Legal Desk: the firm for each account comes from its county, and Firms… adds firms without leaving the desk',
  kind: 'feature',
  highlights: [
    'The firm’s name at the top of the desk is now this account’s firm, with the county that picked it, such as Austin Legal · Travis County. The county comes from the job’s property record, else from where its address sits on the map. A line under the account’s address says where the county came from.',
    'An account in a county no firm covers reads No firm covers Williamson County in amber, and Mark attorney ready waits until a firm takes that county. The desk never guesses a firm. While no county is colored yet, the one firm takes every account as before, and the desk says so.',
    'Jobs in two firms’ counties: the county holding the largest open balance decides, and a ⇄ segment switches the release to the other firm. An account already with a firm keeps that firm.',
    'Firms… at the top right opens the Collections law firms block over the desk, for a dev: add a firm, color its counties, save, and the account’s firm follows. What’s left for us? and the rail’s keeps use each account’s own firm’s fee model.',
  ],
}

export default note
