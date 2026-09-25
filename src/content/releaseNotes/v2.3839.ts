import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3839',
  date: '2026-09-25',
  title: 'Job windows: Escape never closes the job under a smaller window',
  kind: 'fix',
  highlights: [
    'Pressing Escape while a smaller window was open on top of a job — recording a payment, confirming a removal, adding a Drive link, the supply-house packet, a job-account sheet, the Stages drawer, Add people, and others — closed the whole job behind it, and what you had typed in the smaller window was lost.',
    'Escape now leaves the job open while any of those windows is up. In the Add link box, Escape closes just that box; press it again to close the job.',
  ],
}

export default note
