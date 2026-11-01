import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6276',
  date: '2026-11-01',
  title: 'Put an email conversation from Messages on a legal matter',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Legal desk, the Evidence tab has a new press beside Choose files: From the job’s messages. It lists every email conversation on the account’s jobs, and the emails the app sent.',
    'Tick the conversations the firm should read and press Put on the matter. Each email goes on as its own .eml file, with its day, its line on what it shows, and the files we kept inside.',
    'An email already on the matter shows that and has no tick. A document made this way opens its line in Messages from its menu.',
  ],
}

export default note
