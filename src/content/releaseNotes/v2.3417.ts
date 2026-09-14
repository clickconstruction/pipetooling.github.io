import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3417',
  date: '2026-09-14',
  title: 'Pipeline: stages recognized from the line items',
  kind: 'feature',
  highlights: [
    'A job whose line items read Rough In, Top Out, Trim Set in order — the way the Multiple Segment Generator writes them — now shows the stage bar on Jobs → Pipeline without anyone setting Order on the Bill tab: the numbered chips, one bar sized by each stage’s share, the caption.',
    'The crew’s New report on such a job asks which stage they worked on, the same picker a job with Order rows already had.',
    'A change order or a permit line beside the stages stays outside them; a service job (Diagnostic, Parts, Labor) is not a plan and keeps its one bar. Setting Order on the Bill tab still decides how the job bills — recognition never changes a draw.',
  ],
}

export default note
