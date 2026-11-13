import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7198',
  date: '2026-11-13',
  title: 'Lien deadlines: a late notice that can still go is no longer shown as lien gone',
  kind: 'fix',
  highlights: [
    'On the Lien desk’s Deadlines tab, a job whose notice window closed is no longer listed under Overdue and Lien gone while its affidavit can still be filed. It sits in the month of the affidavit’s last day, and its row reads send the late notice.',
    'The month’s bar and the GC’s row count such jobs by name: 1 late notice.',
    'Overdue now holds only jobs whose lien is gone for good. The Share message’s count of jobs past their window follows.',
    'The billed row and the phone chip already said Send the late notice. They now read it from the same clock as the Deadlines tab.',
  ],
}

export default note
