/**
 * GC mode, the real build, the Board's B2: a company window's documents and a customer's activity, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCompanyFile.ts`).
 */
import { paperSentWords } from './paperSend'
import type { GcProject, GcState, Partner, TradePackage } from './types'
import { daysUntil, money, shortDate } from './words'
import { retainageHeldNow } from './building'

export type DocStatus = 'ok' | 'soon' | 'missing' | 'info'

/** One paper in a company's file. `key` is stable, so a paperwork chip can open the window at it. */
export interface CompanyDoc {
  key: string
  title: string
  status: DocStatus
  /** "signed", "good to May 5", "1 owed". */
  statusWords: string
  /** The line under it: when, who, what it covers. */
  meta: string
  projectId?: string
  packageId?: string
}

export interface CompanyDocGroup {
  title: string
  docs: CompanyDoc[]
}

/** The keys a paperwork chip opens at. */
export const DOC_KEYS = { msa: 'msa', insurance: 'insurance', w9: 'w9', vetting: 'vetting' } as const

function awardedPackages(state: GcState, partnerId: string): { project: GcProject; pkg: TradePackage }[] {
  const out: { project: GcProject; pkg: TradePackage }[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      if (awarded?.partnerId === partnerId && pkg.sow) out.push({ project, pkg })
    }
  }
  return out
}

/** The send line for a Documents row, by its key. Null before anything was sent from the window. */
function sentWordsFor(state: GcState, partnerId: string, key: string): string | null {
  if (key === 'msa' || key === 'insurance' || key === 'w9') return paperSentWords(state, partnerId, key)
  if (key.startsWith('sow-')) return paperSentWords(state, partnerId, 'sow', key.slice(4))
  if (key.startsWith('waivers-')) return paperSentWords(state, partnerId, 'waiver', key.slice(8))
  return null
}

/** A trade's file: its company papers, then each job's papers, then its quotes. */
export function partnerDocuments(state: GcState, partner: Partner): { groups: CompanyDocGroup[]; toGet: number } {
  const company: CompanyDoc[] = []
  company.push(
    partner.msa === 'signed'
      ? { key: DOC_KEYS.msa, title: 'Master agreement', status: 'ok', statusWords: 'signed', meta: `Signed ${partner.msaSignedOn ? shortDate(partner.msaSignedOn) : ''} · covers every job with us` }
      : partner.msa === 'sent'
        ? { key: DOC_KEYS.msa, title: 'Master agreement', status: 'missing', statusWords: 'waiting on their signature', meta: `Sent ${partner.msaSentOn ? shortDate(partner.msaSentOn) : ''}. Nothing is awarded on paper until it is signed.` }
        : { key: DOC_KEYS.msa, title: 'Master agreement', status: 'missing', statusWords: 'not sent', meta: 'Send it from here. It is signed once and covers every job.' },
  )
  if (!partner.coiExpires) {
    company.push({ key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'missing', statusWords: 'none on file', meta: 'Nothing they do for us is covered until one comes in.' })
  } else {
    const days = daysUntil(partner.coiExpires, state.today)
    company.push(
      days < 0
        ? { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'missing', statusWords: `ran out ${shortDate(partner.coiExpires)}`, meta: 'Nothing they do for us is covered until the renewed one comes in.' }
        : days <= 30
          ? { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'soon', statusWords: `runs out ${shortDate(partner.coiExpires)}`, meta: `In ${days} ${days === 1 ? 'day' : 'days'}. Ask for the renewed certificate.` }
          : { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'ok', statusWords: `good to ${shortDate(partner.coiExpires)}`, meta: `Runs out in ${days} days.` },
    )
  }
  company.push(
    partner.w9
      ? { key: DOC_KEYS.w9, title: 'W-9', status: 'ok', statusWords: 'on file', meta: 'Signed in their portal. The tax number is never shown here.' }
      : { key: DOC_KEYS.w9, title: 'W-9', status: 'missing', statusWords: 'none on file', meta: 'They fill it in and sign it from the link we email.' },
  )
  if (partner.vetting) {
    const form = partner.vetting.form
    company.push({
      key: DOC_KEYS.vetting,
      title: 'Company form',
      status: form ? 'info' : 'missing',
      statusWords: form ? `sent ${shortDate(form.sentOn)}` : 'not sent yet',
      meta: form ? `License ${form.license} · ${form.yearsInBusiness} years in business` : 'A company new to us sends it from its portal before any award.',
    })
  }
  const groups: CompanyDocGroup[] = [{ title: 'Their company papers', docs: company }]

  for (const { project, pkg } of awardedPackages(state, partner.id)) {
    const sow = pkg.sow
    if (!sow) continue
    const docs: CompanyDoc[] = []
    const ids = { projectId: project.id, packageId: pkg.id }
    docs.push({
      key: `sow-${pkg.id}`,
      title: 'Statement of work',
      // A draft is ours to send, not a paper to get from them.
      status: sow.status === 'signed' ? 'ok' : sow.status === 'sent' ? 'missing' : 'info',
      statusWords: sow.status === 'signed' ? 'signed' : sow.status === 'sent' ? 'waiting on their signature' : 'drafted, not sent yet',
      meta: `${money(sow.price)}${sow.signedOn ? ` · signed ${shortDate(sow.signedOn)}` : ''}${(sow.excluded ?? []).length > 0 ? ` · they will not do: ${(sow.excluded ?? []).map((x) => x.name.toLowerCase()).join(', ')}` : ''}`,
      ...ids,
    })
    if (sow.draws.length > 0) {
      docs.push({
        key: `payapps-${pkg.id}`,
        title: 'Pay applications',
        status: 'info',
        statusWords: `${sow.draws.length} sent`,
        meta: sow.draws.map((d) => `draw ${d.number} ${d.status === 'requested' ? 'waiting on us' : d.status}${d.paidOn ? ` ${shortDate(d.paidOn)}` : ''}`).join(' · '),
        ...ids,
      })
      const owed = sow.draws.filter((d) => d.status === 'paid' && d.waiver === 'conditional')
      docs.push({
        key: `waivers-${pkg.id}`,
        title: 'Lien waivers',
        status: owed.length > 0 ? 'missing' : 'ok',
        statusWords: owed.length > 0 ? `${owed.length} owed` : 'all in',
        meta: owed.length > 0 ? `Unconditional owed on draw ${owed.map((d) => d.number).join(', ')}` : 'Every paid draw has its unconditional waiver.',
        ...ids,
      })
    }
    groups.push({ title: `${project.name} · ${pkg.trade}`, docs })
  }

  const quotes: CompanyDoc[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      if (!invite?.bid) continue
      quotes.push({
        key: `quote-${invite.id}`,
        title: `Quote, ${project.name}`,
        status: 'info',
        statusWords: money(invite.bid.amount),
        meta: `${pkg.trade} · sent ${shortDate(invite.bid.submittedOn)}${invite.bid.quoteFile ? ` · their file ${invite.bid.quoteFile}` : ''}${(invite.bid.exclusions ?? []).length > 0 ? ` · excludes ${(invite.bid.exclusions ?? []).map((e) => e.name.toLowerCase()).join(', ')}` : ''}`,
        projectId: project.id,
        packageId: pkg.id,
      })
    }
  }
  if (quotes.length > 0) groups.push({ title: 'Their quotes', docs: quotes })
  // What we sent from this window, ahead of each row's line: "Reminded today · sign by Fri Oct 9."
  const withSends = groups.map((g) => ({
    ...g,
    docs: g.docs.map((d) => {
      const sent = sentWordsFor(state, partner.id, d.key)
      return sent ? { ...d, meta: `${sent} ${d.meta}` } : d
    }),
  }))
  const toGet = withSends.flatMap((g) => g.docs).filter((d) => d.status === 'missing' || d.status === 'soon').length
  return { groups: withSends, toGet }
}

/** A made-up paper the window shows beside the list. The real build opens the file itself. */
export interface CompanyPaper {
  heading: string
  rows: { label: string; value: string }[]
  table?: { head: string[]; rows: string[][] }
  foot: string
}

const US = 'Click Construction'

const REAL_FILE = 'In the real build, the file itself opens here.'

/** "Sep 15, 2025": a policy period needs its years. */
function dateWithYear(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${shortDate(iso)}, ${d.getFullYear()}`
}

function yearBefore(iso: string): string {
  return `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`
}

/** The paper behind one of a trade's documents. A W-9's tax number is never in it. */
export function partnerPaper(state: GcState, partner: Partner, key: string): CompanyPaper | null {
  const doc = partnerDocuments(state, partner).groups.flatMap((g) => g.docs).find((d) => d.key === key)
  if (!doc) return null
  const project = state.projects.find((p) => p.id === doc.projectId)
  const pkg = project?.packages.find((k) => k.id === doc.packageId)
  if (key === DOC_KEYS.msa) {
    return {
      heading: 'Master subcontract agreement',
      rows: [
        { label: 'Between', value: `${US} and ${partner.company}` },
        { label: 'Signed', value: partner.msa === 'signed' && partner.msaSignedOn ? `${shortDate(partner.msaSignedOn)} by ${partner.contact}` : 'not yet' },
        { label: 'Covers', value: 'every job we award them. Each job has its own statement of work with the price and the work.' },
        { label: 'Insurance', value: `general liability, with ${US} named as additional insured` },
        { label: 'Retainage', value: 'held on each draw until their work is accepted' },
        { label: 'Lien waivers', value: 'conditional with each pay application, unconditional once it is paid' },
      ],
      foot: REAL_FILE,
    }
  }
  if (key === DOC_KEYS.insurance) {
    if (!partner.coiExpires) return { heading: 'Certificate of liability insurance', rows: [{ label: 'On file', value: 'nothing yet' }], foot: 'Ask for it. Nothing they do for us is covered until it comes in.' }
    return {
      heading: 'Certificate of liability insurance',
      rows: [
        { label: 'Insured', value: `${partner.company}${partner.base ? `, ${partner.base}` : ''}` },
        { label: 'Insurer', value: partner.vetting?.form?.insurance ?? 'Texas Mutual Insurance Co.' },
        { label: 'General liability', value: '$1,000,000 each occurrence · $2,000,000 aggregate' },
        { label: 'Auto', value: '$1,000,000 combined single limit' },
        { label: "Workers' comp", value: "Statutory · employer's liability $1,000,000" },
        { label: 'Policy period', value: `${dateWithYear(yearBefore(partner.coiExpires))} to ${dateWithYear(partner.coiExpires)}` },
        { label: 'Certificate holder', value: `${US} · additional insured` },
      ],
      foot: REAL_FILE,
    }
  }
  if (key === DOC_KEYS.w9) {
    return {
      heading: 'Form W-9',
      rows: [
        { label: 'Name', value: partner.company },
        { label: 'Address', value: partner.address ?? 'on the form' },
        { label: 'Tax number', value: 'on file · never shown here' },
        { label: 'Signed', value: partner.w9 ? 'in their portal' : 'not yet' },
      ],
      foot: 'The tax number goes to the books only. It never shows on a screen.',
    }
  }
  if (key === DOC_KEYS.vetting) {
    const form = partner.vetting?.form
    if (!form) return { heading: 'Their company form', rows: [{ label: 'Sent', value: 'not yet' }], foot: 'A new company sends it from its portal before any award.' }
    return {
      heading: 'Their company form',
      rows: [
        { label: 'License', value: form.license },
        { label: 'Insurance', value: form.insurance },
        { label: 'Years in business', value: `${form.yearsInBusiness}` },
        { label: 'References', value: form.references },
        { label: 'Jobs like ours', value: form.pastJobs },
        { label: 'Sent', value: shortDate(form.sentOn) },
      ],
      foot: 'What they wrote in their portal.',
    }
  }
  const sow = pkg?.sow
  if (project && pkg && sow && key.startsWith('sow-')) {
    return {
      heading: 'Statement of work',
      rows: [
        { label: 'Job', value: `${project.name} · ${pkg.trade}` },
        { label: 'Price', value: money(sow.price) },
        { label: 'Retainage', value: `${sow.retainagePct}%` },
        { label: 'Signed', value: sow.signedOn ? shortDate(sow.signedOn) : 'not yet' },
        { label: 'They will not do', value: (sow.excluded ?? []).length > 0 ? (sow.excluded ?? []).map((x) => x.name).join(', ') : 'nothing listed' },
      ],
      table: { head: ['Line', 'Amount'], rows: sow.sov.map((l) => [l.label, money(l.amount)]) },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && sow && key.startsWith('payapps-')) {
    return {
      heading: 'Their pay applications',
      rows: [{ label: 'Job', value: `${project.name} · ${pkg.trade}` }],
      table: {
        head: ['Draw', 'Asked', 'Gross', 'Retainage', 'Net', 'Where'],
        rows: sow.draws.map((d) => [`${d.number}`, shortDate(d.requestedOn), money(d.gross), money(d.retainage), money(d.net), d.status === 'paid' && d.paidOn ? `paid ${shortDate(d.paidOn)}` : d.status]),
      },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && sow && key.startsWith('waivers-')) {
    return {
      heading: 'Lien waivers',
      rows: [{ label: 'Job', value: `${project.name} · ${pkg.trade}` }],
      table: {
        head: ['Draw', 'Conditional', 'Unconditional'],
        rows: sow.draws.map((d) => [
          `${d.number}`,
          'in, with the pay application',
          d.waiver === 'unconditional' ? 'in' : d.status === 'paid' ? `owed since ${shortDate(d.paidOn ?? d.requestedOn)}` : 'once it is paid',
        ]),
      },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && key.startsWith('quote-')) {
    const bid = pkg.invites.find((i) => `quote-${i.id}` === key)?.bid
    if (!bid) return null
    return {
      heading: 'Their quote',
      rows: [
        { label: 'Job', value: `${project.name} · ${pkg.trade}` },
        { label: 'Amount', value: money(bid.amount) },
        { label: 'Sent', value: shortDate(bid.submittedOn) },
        ...(bid.goodForDays ? [{ label: 'Good for', value: `${bid.goodForDays} days` }] : []),
        ...(bid.quoteFile ? [{ label: 'Their file', value: bid.quoteFile }] : []),
        { label: 'Leaves out', value: (bid.exclusions ?? []).length > 0 ? (bid.exclusions ?? []).map((e) => e.name).join(', ') : 'nothing listed' },
        ...(bid.note ? [{ label: 'Their note', value: bid.note }] : []),
      ],
      foot: REAL_FILE,
    }
  }
  return null
}

/** The work a trade has with us and where its money stands: what About leads with. */
export interface PartnerWork {
  jobs: { project: GcProject; pkg: TradePackage; price: number; signed: boolean }[]
  underContract: number
  paid: number
  /** Approved, not paid yet. */
  approved: number
  /** Retainage we hold on their draws. */
  held: number
}

export function partnerWork(state: GcState, partner: Partner): PartnerWork {
  const jobs = awardedPackages(state, partner.id).map(({ project, pkg }) => ({ project, pkg, price: pkg.sow?.price ?? 0, signed: pkg.sow?.status === 'signed' }))
  let paid = 0
  let approved = 0
  let held = 0
  for (const { pkg } of jobs) {
    if (!pkg.sow) continue
    for (const d of pkg.sow.draws) {
      if (d.status === 'paid') paid += d.net
      if (d.status === 'approved') approved += d.net
    }
    held += retainageHeldNow(pkg.sow)
  }
  return { jobs, underContract: jobs.reduce((t, j) => t + j.price, 0), paid, approved, held }
}
