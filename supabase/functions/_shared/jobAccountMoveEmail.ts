/**
 * The move window's ask (punch list #132 PR 3, v2.5677): the email asking a supply house's
 * job-accounts rep to move still-current charges onto their jobs' job accounts. Lives here
 * so `request-job-account-move` sends exactly what Settings → What customers see renders
 * over the sample (the v2.3512 rule).
 */

export type JobAccountMoveJob = {
  /** "4019 · Kestrel Homes — 1210 Mesa Verde" */
  label: string
  /** The house's reference when the account is open and has one. */
  accountRef: string | null
  accountOpen: boolean
  charges: Array<{ number: string; dateMdY: string; money: string; po: string | null }>
}

export type JobAccountMoveEmailInput = {
  repName: string | null
  senderName: string
  companyName: string
  jobs: JobAccountMoveJob[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function accountLine(job: JobAccountMoveJob): string {
  if (job.accountOpen && job.accountRef) return `Job account ref ${job.accountRef}.`
  if (job.accountOpen) return 'The job account is open with you.'
  return 'No job account for this job yet — please open one with the move.'
}

export function jobAccountMoveSubject(input: JobAccountMoveEmailInput): string {
  const charges = input.jobs.flatMap((j) => j.charges)
  if (charges.length === 1) {
    const jobNum = (input.jobs[0]?.label ?? '').split(' ·')[0] || 'the'
    return `Move invoice ${charges[0]!.number} to the ${jobNum} job account`
  }
  return `Move ${charges.length} charges onto job accounts — ${input.companyName}`
}

export function buildJobAccountMoveEmail(input: JobAccountMoveEmailInput): { subject: string; text: string; html: string } {
  const charges = input.jobs.flatMap((j) => j.charges)
  const noun = charges.length === 1 ? 'charge' : 'charges'
  const intro = `Hi${input.repName?.trim() ? ` ${input.repName.trim()}` : ''} — please move the ${noun} below onto the job ${charges.length === 1 ? 'account' : 'accounts'} named. ${charges.length === 1 ? 'It is' : 'They are'} still current.`
  const followLine = `We'll call to confirm. Reply here or reach ${input.senderName} at this address.`
  const chargeLine = (c: JobAccountMoveJob['charges'][number]) => `${c.number} · ${c.dateMdY} · ${c.money}${c.po?.trim() ? ` · PO ${c.po.trim()}` : ''}`
  const textGroups = input.jobs.map((j) => `${j.label}\n${accountLine(j)}\n${j.charges.map((c) => `  - ${chargeLine(c)}`).join('\n')}`)
  const htmlGroups = input.jobs.map(
    (j) =>
      `<p style="margin:14px 0 2px"><strong>${esc(j.label)}</strong><br><span style="color:#555">${esc(accountLine(j))}</span></p><ul style="margin:4px 0 0">${j.charges.map((c) => `<li>${esc(chargeLine(c))}</li>`).join('')}</ul>`,
  )
  return {
    subject: jobAccountMoveSubject(input),
    text: `${intro}\n\n${textGroups.join('\n\n')}\n\n${followLine}\n\n— ${input.companyName}`,
    html: `<div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#222"><p>${esc(intro)}</p>${htmlGroups.join('')}<p style="margin-top:16px">${esc(followLine)}</p><p>— ${esc(input.companyName)}</p></div>`,
  }
}
