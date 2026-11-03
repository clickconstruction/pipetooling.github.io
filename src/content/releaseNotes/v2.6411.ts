import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6411',
  date: '2026-11-02',
  title: 'Signed hours statement: sent for a signature, signed on a phone or on paper, the signed PDF on the job and the desk (punch list #212, PR 3)',
  kind: 'feature',
  highlights: [
    'Send for signature… on the Hours statement window now works. It saves the statement, turns the paper into a form the worker signs on their phone, and offers four ways to reach them: Email the link, Text the link, Copy the link, or Hand the phone to the worker on this device. Sign here now is that last one in one press.',
    'The worker reads the paper as a form, types any days the app did not record into the stated rows, signs with a finger or a typed name, and the signed PDF files itself on the job’s Documents tab and on their desk under Paperwork. The statement reads Waiting for a signature, then Signed, and keeps the days they typed.',
    'File a signed scan… keeps a paper the worker signed with a pen: attach the photo or PDF, say who signed and when, type the days they wrote, and the statement reads Signed with the scan beside its filled PDF.',
    'Open the signed PDF opens the signed copy through the same gate as every signed form, each open logged. An assistant opens the hours-only paper; the paper with the money opens for the payroll roles.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
