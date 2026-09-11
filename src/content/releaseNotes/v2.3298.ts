import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3298',
  date: '2026-09-11',
  title: 'Test reports live on the job',
  kind: 'feature',
  highlights: [
    'The orange wrench on every Pipeline row (and in the mobile card\'s ⋯ sheet) now opens Test report — a modal prefilled from the job: customer, address, phone, the GC. Pick Pre-Test / Post-Test (Supply or Sewer), Pinpoint or Gas, the date, PASS or FAIL, add notes; the paper renders beside the form as you type.',
    'Reports save on the job and show as chips at the top of the modal, so "which pre-test was that" is answered on the job instead of in a browser tab. Download PDF gives the real-text letterhead paper.',
    'Settings → Jobs & billing → Test reports holds who certifies and every sentence on the paper. Nothing is hard-coded any more; a report already sent keeps its certifier.',
    'Send to the GC with the pay link is the next release. The old site stays one click away in the modal\'s footer until then.',
  ],
}

export default note
