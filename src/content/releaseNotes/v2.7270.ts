import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7270',
  date: '2026-11-14',
  title: 'Lien affidavit: set the months the paper swears by hand, with counsel’s reason',
  kind: 'feature',
  highlights: [
    'On the Lien desk’s affidavit pane, under Months the affidavit claims, press Set the months by hand…. Tick the months the paper names, from the job’s own work months and the notice’s months, or add another, and type counsel’s reason: who said the paper may name them, and when.',
    'The paper then names those months in place of the ones the recorded notices name. The pane, the job’s Lien window and the batch help sheet say the months are set by hand, with who, when and the reason. The attorney line still reads each month against the notice record.',
    'Change… and Clear take the setting back. The record stays per job, as the claim set by hand does.',
    'The dev seat’s plan_affidavit_draft reply carries the setting under months_set_by_hand.',
  ],
}

export default note
