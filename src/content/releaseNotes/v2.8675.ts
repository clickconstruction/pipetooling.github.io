import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8675',
  date: '2026-11-26',
  title: 'Settings: the developer can take today’s goals check back',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Settings → Data & recovery has a new block for the developer, Today’s goals check. Nobody else sees it.',
    'It reads whether your own account passed today’s check, and when. Take today’s check back… removes that one record, so the check asks again.',
    'The window that asks first has a button that reads Take the check back. It says your goals and your clock sessions stay.',
    'The block says when the check comes again: at the next load of the app if you have a clock session today, and after your first clock in if you have none.',
  ],
}

export default note
