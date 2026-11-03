import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6385',
  date: '2026-11-02',
  title: 'Today’s sends: Stop reminding and Hold until work on a homeowner’s text',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Stop reminding on this job and Hold until… on a homeowner’s text no longer fail with “stepUnknown”. The app now finds the step on the homeowner flow, where the text came from.',
    'A homeowner’s row names them from their customer record and names the step, instead of showing their phone number and a bare key.',
    'If a step really was taken off the flow after the text was prepared, the message says which step and tells you to press Not this one.',
  ],
}

export default note
