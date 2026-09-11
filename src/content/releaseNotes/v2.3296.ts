import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3296',
  date: '2026-09-11',
  title: 'Test reports come inside: the paper, first',
  kind: 'feature',
  highlights: [
    'The hydrostatic, pinpoint and gas test report that used to be built on plumbingtooling.com now has a home in this app. This first step is the document itself: real, selectable text on the company letterhead, with the certification block and license number kept as settings instead of buried in code.',
    'Settings → What customers see gains a "Test report (sample)" row with four buttons — sewer pre-test PASS, supply post-test FAIL, pinpoint, gas — each opening the PDF as a customer would receive it. Look it over before the next step wires it to real jobs.',
    'Nothing on the Jobs board changes yet: the Plumbing Tooling button still opens the old site. The modal, Send to the GC, and the portal card follow in the next releases.',
  ],
}

export default note
