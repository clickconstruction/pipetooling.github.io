import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3303',
  date: '2026-09-11',
  title: 'The clock-out report drafts the test report',
  kind: 'feature',
  highlights: [
    'When a tech files a Status Report or Job Complete on a pretest, post-test, pinpoint or gas job, a Test report draft appears on that job by itself: the type from the job name, PASS or FAIL read from what the tech wrote ("Hydrostatic test passed", "no hydrostatic loss detected", "failed — lost 2 inches"), the date from the report.',
    'The office sees it on the Dashboard as "N test reports ready to send", opens it, glances at the paper, and sends. Nothing to re-type.',
    'One draft per job and test: a second report on the same job fills in a missing verdict instead of adding another. A report that doesn\'t say pass or fail leaves the verdict for the office.',
  ],
}

export default note
