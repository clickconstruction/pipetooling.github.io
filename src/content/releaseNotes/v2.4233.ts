import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4233',
  date: '2026-09-30',
  title: 'Plain words is the rule for every new or changed guide and walkthrough',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules the Submittals walkthrough set on 2026-09-29 are now the convention for anything a first-timer reads: one idea per sentence, none over twenty words, the control’s exact name, a plain word beside a trade word the first time, nothing glued with dashes or brackets.',
    'A new help guide is held to them from its first commit. A guide written before the rules joins the moment a change touches it: the build fails until it is rewritten. Nothing changes in the app today.',
  ],
}

export default note
