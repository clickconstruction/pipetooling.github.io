import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6326',
  date: '2026-11-02',
  title: 'Adopting a bid that took robot fixtures keeps one Robot source on the package',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'When you adopt a bid as a version and both bids took robot fixtures, the package now keeps its own Robot count source and the adopted bid\'s robot rows join it. The Counts tab\'s From tile shows one Robot chip, not two.',
    'Set aside and Undo on the adopted rows find that one source, so a row never stays shaded after its share is taken off.',
    'The adopt\'s log line counts only the CountTooling projects that arrived; the robot\'s folded row is not one.',
  ],
}

export default note
