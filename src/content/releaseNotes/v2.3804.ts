import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3804',
  date: '2026-09-24',
  title: 'The office hears about a returned check the moment the bank reports it',
  kind: 'feature',
  highlights: [
    'When Mercury reports that a check already matched to a job has come back, the office now gets an email and a push right then — “Southern Post’s check for $13,680 on J878 Take 5 – Seguin came back: Insufficient funds” — with a link that opens the job on ③ Payments received, where Unlink and remove takes the payment off. Until now the first word was the bank’s, days later.',
    'It goes to the people on the Payment made email stream (Settings → Email streams), or to the whole office when that list is empty, and only once per deposit however many times the bank repeats itself.',
    'Only a check the bank first accepted and then returned counts, and only while a job still counts it as paid. A check that bounced before anyone matched it raises nothing here — Accounts Receivable already marks it returned by the bank. Nothing is taken off a job on its own; the button is still the record of who decided.',
  ],
}

export default note
