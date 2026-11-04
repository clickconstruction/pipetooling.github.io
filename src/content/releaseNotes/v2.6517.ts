import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6517',
  date: '2026-11-04',
  title: 'Everyone already on the roster without a login can now hold hours and a Charged as',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Every person on the roster who had no login — subs, helpers, people who left — now has their own row, so a dev can import their days and the office can set their Charged as in Who counts as what, and a job they worked prices every day.',
    'On People → Users they read as rows with the no login chip under their kind. Nothing about them moved: their pay, paperwork, portal and sub sheets are where they were.',
    'A record whose name another person already carries was left as it was and is named in the push’s answer, since pay is keyed by name. Link or combine it from the desk.',
  ],
}

export default note
