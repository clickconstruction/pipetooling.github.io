/**
 * Settings → What customers see → Lien letters (punch list #326): every letter that goes out on an unpaid job under a
 * general contractor, in the order it goes, drawn by the builders the Lien desk and the Lien window send with. One
 * made-up job carries all of them, so the notice, the reminder, the second letter and the affidavit name the same
 * month, the same claim and the same days.
 *
 * The owner asked for it (2026-11-12): *a what customer sees for all the different letters that go out and the
 * different stages we have available to us as relate to liens*. The order here is the app's own: the § 53.056 notice,
 * the courtesy notice, the attorney's letter, the affidavit, the release. The demand letter and the retainage notice
 * sit beside that ladder.
 *
 * Pure. Nothing here reads the database, and every name, address and figure is invented.
 */
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { lienFilingEmailHtml } from '../../../supabase/functions/_shared/lienFilingEmail'
import { SAMPLE_GC, ymdPlusDays } from '../customerSample'
import { demandMoney } from '../jobsDocuments/demandLetter'
import {
  buildLienAffidavitBlocks,
  buildLienNoticeBlocks,
  buildLienRetainageNoticeBlocks,
  buildReleaseOfRecordBlocks,
  filingDocFooter,
  filingDocPrintHtml,
  lienAffidavitPrintOptions,
  type FilingDocBlock,
  type FilingDocExtras,
  type LienAffidavitFields,
  type LienNoticeFields,
  type ReleaseOfRecordFields,
} from '../jobsDocuments/lienFilingDocuments'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends } from '../jobs/lienAffidavitNotices'
import { courtesyEmailText, courtesyGreeting, courtesyOwnerSubject, courtesySubject, courtesyTextBody, type CourtesyFacts, type CourtesyWho } from '../jobs/lienCourtesyNotice'
import { filingDeadlineForMonth, serveDueForFiling } from '../jobs/lienDeadlines'
import { runCoverNoteBlocks } from '../jobs/lienDeskRun'
import { LETTER_TWO_FROM_DAY, type LetterTwoKind } from '../jobs/lienLetterTwo'
import { describeNoticeMonths } from '../jobs/lienNoticeDraft'
import { affidavitMonthWordFor, defaultGcNoticeCoverLetter, fillCoverLetter, letterTwoTemplate } from '../jobs/gcOnNotice'
import type { PaperSample } from './paperSamples'

/** The owner of record on the sample project, and the project as a notice names it. */
export const SAMPLE_OWNER = { name: 'Sample Owner LLC', project: 'Cedar Bend Apartments, 4400 Sample Pkwy, Kyle, TX 78640' } as const

/** The one unpaid job every lien letter is drawn on. Apartments, so the later, commercial clock applies. */
export const SAMPLE_LIEN_JOB = {
  number: '1077',
  name: 'Cedar Bend Apartments',
  address: '4400 Sample Pkwy, Kyle, TX 78640',
  county: 'Hays',
  propertyKind: 'non_residential',
  legalDescription: 'Lot 1, Block A, Sample Bend Subdivision',
  ownerAddress: '900 Sample Tower Blvd, Austin, TX 78701',
  gcAddress: '250 Sample Yard Rd, Buda, TX 78610',
  claim: 12400,
  retainage: 1240,
  recordingNumber: '2026-0000000',
} as const

/** The office, as a sample letter signs: never a real person. */
const SAMPLE_CONTACT = 'The office'

export type SampleLienDays = {
  /** The unpaid work month, 'YYYY-MM'. */
  month: string
  /** The day the § 53.056 packet went. */
  noticeSentOn: string
  /** The day the attorney's letter may first go: day 10 after the packet. */
  letterTwoOn: string
  /** The affidavit's last day: the 15th of the fourth month after the work month. */
  lienDay: string
  /** The day the sample affidavit is filed: a week inside its last day. */
  filedOn: string
  /** The last day to mail the filed copy to the owner and the builder. */
  serveBy: string
  /** The day the money lands and the release is signed. */
  paidOn: string
}

/** The sample job's days, counted from today by the Lien desk's own date rules. */
export function sampleLienDays(todayYmd: string): SampleLienDays {
  const month = ymdPlusDays(todayYmd, -75).slice(0, 7)
  const noticeSentOn = ymdPlusDays(todayYmd, -21)
  const lienDay = filingDeadlineForMonth(`${month}-01`, SAMPLE_LIEN_JOB.propertyKind)
  const filedOn = ymdPlusDays(lienDay, -7)
  return { month, noticeSentOn, letterTwoOn: ymdPlusDays(noticeSentOn, LETTER_TWO_FROM_DAY), lienDay, filedOn, serveBy: serveDueForFiling(filedOn), paidOn: ymdPlusDays(filedOn, 21) }
}

function letterhead(): NonNullable<FilingDocExtras['letterhead']> {
  return { company: PORTAL_COMPANY.name, licenseLine: PORTAL_COMPANY.licenseLine, contactLines: [PORTAL_COMPANY.phone] }
}

const jobLabel = `${SAMPLE_LIEN_JOB.number} · ${SAMPLE_LIEN_JOB.name}`

/** The § 53.056 form's fields for the sample job, dated the day it would go. */
export function sampleLienNoticeFields(noticeDate: string): LienNoticeFields {
  return {
    noticeDate,
    projectDescription: SAMPLE_OWNER.project,
    claimantName: PORTAL_COMPANY.name,
    laborMaterialsType: 'Plumbing labor and materials',
    originalContractorName: SAMPLE_GC.company,
    contractedWithIfDifferent: '',
    claimAmount: demandMoney(SAMPLE_LIEN_JOB.claim.toFixed(2)).replace(/^\$/, ''),
    contactPerson: `${SAMPLE_CONTACT} · ${PORTAL_COMPANY.phone}`,
    claimantAddress: `${PORTAL_COMPANY.name}, Kyle, TX`,
  }
}

/** The notice to the owner of record as the tab has drawn it since v2.3509: the form, dated today. */
export function sampleOwnerNoticeInputs(todayYmd: string): { fields: LienNoticeFields; extras: FilingDocExtras } {
  return {
    fields: sampleLienNoticeFields(todayYmd),
    extras: { letterhead: letterhead(), refItems: [`Re: ${SAMPLE_OWNER.project}`, `Original contractor: ${SAMPLE_GC.company}`, `Unpaid: ${ymdPlusDays(todayYmd, -60).slice(0, 7)}`] },
  }
}

function paper(title: string, subject: string, blocks: FilingDocBlock[], filename: string, footer?: string, opts?: Parameters<typeof filingDocPrintHtml>[3]): PaperSample {
  return {
    title,
    subject,
    html: filingDocPrintHtml(blocks, title, footer, opts),
    filename,
    pdf: async () => (await import('../jobsDocuments/lienFilingDocuments')).filingDocPdfBlob(blocks, footer ? { footer } : undefined),
  }
}

export function sampleOwnerNotice(todayYmd: string): PaperSample {
  const { fields, extras } = sampleOwnerNoticeInputs(todayYmd)
  const blocks = buildLienNoticeBlocks(fields, extras)
  return {
    title: 'Notice of Claim for Unpaid Labor or Materials (§ 53.056)',
    subject: `Notice of claim — ${SAMPLE_OWNER.project}`,
    html: filingDocPrintHtml(blocks, 'Notice of Claim for Unpaid Labor or Materials'),
    filename: 'Notice-53-056-sample.pdf',
    pdf: async () => (await import('../jobsDocuments/lienFilingDocuments')).filingDocPdfBlob(blocks),
  }
}

/** What a cover letter's blanks resolve to on the sample job, as the run fills them for a real one. */
function coverFills(days: SampleLienDays) {
  return {
    property: SAMPLE_LIEN_JOB.address,
    months: describeNoticeMonths([days.month]),
    job: SAMPLE_LIEN_JOB.number,
    amount: demandMoney(SAMPLE_LIEN_JOB.claim.toFixed(2)),
    // Blank, so a letter reads "call our office": a sample never names a person.
    contact: '',
    phone: PORTAL_COMPANY.phone,
    affidavitMonth: affidavitMonthWordFor(SAMPLE_LIEN_JOB.propertyKind),
  }
}

/** A cover page as the packet prints it: the letterhead, the job and its month, the letter, the signature. */
function coverBlocks(letter: string, days: SampleLienDays, noticeDate: string): FilingDocBlock[] {
  return runCoverNoteBlocks({
    label: jobLabel,
    months: [days.month],
    fields: sampleLienNoticeFields(noticeDate),
    extras: { letterhead: letterhead() },
    coverNote: null,
    coverLetter: fillCoverLetter(letter, coverFills(days)),
    kind: 'notice_53_056',
    withInvoices: true,
  })
}

/** Step 1's first page: counsel's cover letter, in front of the notice in the owner's envelope. */
export function sampleLienCoverLetter(todayYmd: string): PaperSample {
  const days = sampleLienDays(todayYmd)
  const letter = defaultGcNoticeCoverLetter({ gcName: SAMPLE_GC.company, claimantName: PORTAL_COMPANY.name, kind: 'commercial' })
  return paper('Cover letter with the notice of claim', `Notice of claim — ${SAMPLE_OWNER.project}`, coverBlocks(letter, days, days.noticeSentOn), 'Notice-cover-letter-sample.pdf')
}

export const LETTER_TWO_SAMPLE_TITLES: Record<LetterTwoKind, string> = {
  paid_out: 'Attorney’s letter: the owner may have paid the builder in full',
  unresponsive: 'Attorney’s letter: the builder is not answering',
}

/** Step 3: the second owner letter, either of counsel's two, on the same job. The notice form rides behind it again. */
export function sampleLetterTwo(kind: LetterTwoKind, todayYmd: string): PaperSample {
  const days = sampleLienDays(todayYmd)
  const letter = letterTwoTemplate(kind, { gcName: SAMPLE_GC.company, claimantName: PORTAL_COMPANY.name })
  return paper(LETTER_TWO_SAMPLE_TITLES[kind], `Notice of claim — ${SAMPLE_OWNER.project}`, coverBlocks(letter, days, days.letterTwoOn), `Attorneys-letter-${kind === 'paid_out' ? 'paid-out' : 'not-answering'}-sample.pdf`)
}

/** Beside the ladder: the § 53.057 form for money the builder holds back. */
export function sampleRetainageNotice(todayYmd: string): PaperSample {
  const fields: LienNoticeFields = { ...sampleLienNoticeFields(todayYmd), claimAmount: demandMoney(SAMPLE_LIEN_JOB.retainage.toFixed(2)).replace(/^\$/, '') }
  const blocks = buildLienRetainageNoticeBlocks(fields, { letterhead: letterhead(), refItems: [`Re: ${SAMPLE_OWNER.project}`, `Original contractor: ${SAMPLE_GC.company}`] })
  return paper('Notice of Claim for Unpaid Retainage (§ 53.057)', `Notice of claim for unpaid retainage — ${SAMPLE_OWNER.project}`, blocks, 'Notice-53-057-retainage-sample.pdf', filingDocFooter('retainage_53_057'))
}

/** The affidavit's fields on the sample job: the short form, a job under a builder, one notice mailed. */
export function sampleLienAffidavitFields(todayYmd: string): LienAffidavitFields {
  const days = sampleLienDays(todayYmd)
  const claim = demandMoney(SAMPLE_LIEN_JOB.claim.toFixed(2)).replace(/^\$/, '')
  const sends = lienAffidavitOwnerSends([{ kind: 'notice_53_056', months_covered: [days.month], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: days.noticeSentOn }] }])
  return {
    county: SAMPLE_LIEN_JOB.county,
    claimantPersonName: 'The company owner',
    claimantCompany: PORTAL_COMPANY.name,
    claimantAddress: `${PORTAL_COMPANY.name}, Kyle, TX`,
    legalDescription: SAMPLE_LIEN_JOB.legalDescription,
    propertyAddress: SAMPLE_LIEN_JOB.address,
    contractedWithName: SAMPLE_GC.company,
    workDescription: 'Plumbing labor and materials',
    workStart: `${days.month}-01`,
    workEnd: `${days.month}-28`,
    ownerName: SAMPLE_OWNER.name,
    ownerAddress: SAMPLE_LIEN_JOB.ownerAddress,
    originalContractorName: SAMPLE_GC.company,
    originalContractorAddress: SAMPLE_LIEN_JOB.gcAddress,
    contractAmount: claim,
    paidAmount: '0.00',
    unpaidAmount: claim,
    includeNoticesSworn: true,
    form: 'short',
    isSub: true,
    workMonthsWords: describeNoticeMonths([days.month]),
    noticesSentWords: lienAffidavitNoticesWords(sends),
  }
}

/** Step 4: the lien itself, as it is filed with the county clerk and then mailed to the owner and the builder. */
export function sampleLienAffidavit(todayYmd: string): PaperSample {
  const f = sampleLienAffidavitFields(todayYmd)
  return paper('Mechanic’s and Materialman’s Lien Affidavit', `Lien affidavit filed — ${SAMPLE_OWNER.project}`, buildLienAffidavitBlocks(f), 'Lien-affidavit-sample.pdf', filingDocFooter('affidavit'), lienAffidavitPrintOptions(f))
}

export function sampleReleaseOfRecordFields(todayYmd: string): ReleaseOfRecordFields {
  const days = sampleLienDays(todayYmd)
  return {
    county: SAMPLE_LIEN_JOB.county,
    claimantCompany: PORTAL_COMPANY.name,
    claimantPersonName: 'The company owner',
    recordingNumber: SAMPLE_LIEN_JOB.recordingNumber,
    filedDate: days.filedOn,
    legalDescription: SAMPLE_LIEN_JOB.legalDescription,
    propertyAddress: SAMPLE_LIEN_JOB.address,
    ownerName: SAMPLE_OWNER.name,
    paymentDate: days.paidOn,
  }
}

/** Step 5: the paper that takes a recorded lien off the property once the claim is paid. */
export function sampleReleaseOfRecord(todayYmd: string): PaperSample {
  return paper('Release of Mechanic’s and Materialman’s Lien', `Release of lien — ${SAMPLE_OWNER.project}`, buildReleaseOfRecordBlocks(sampleReleaseOfRecordFields(todayYmd)), 'Release-of-lien-sample.pdf', filingDocFooter('release_of_record'))
}

/** What the courtesy notice says on the sample job. The pay page's address is made up and opens nothing. */
export function sampleCourtesyFacts(todayYmd: string): CourtesyFacts {
  const days = sampleLienDays(todayYmd)
  return {
    jobNumber: SAMPLE_LIEN_JOB.number,
    jobName: SAMPLE_LIEN_JOB.name,
    propertyAddress: SAMPLE_LIEN_JOB.address,
    county: SAMPLE_LIEN_JOB.county,
    gcName: SAMPLE_GC.company,
    claimantName: PORTAL_COMPANY.name,
    claim: SAMPLE_LIEN_JOB.claim,
    monthsWords: describeNoticeMonths([days.month]),
    noticeSentOn: days.noticeSentOn,
    lienDay: days.lienDay,
    payLinks: [{ address: 'my.clickplumbing.com/pay/sample', amount: SAMPLE_LIEN_JOB.claim }],
    contactPerson: SAMPLE_CONTACT,
    phone: PORTAL_COMPANY.phone,
    offer: null,
  }
}

/** Step 2 by email, as the owner or the builder reads it: the Lien desk's own words in the lien email's own frame. */
export function sampleCourtesyEmail(who: CourtesyWho, todayYmd: string): { subject: string; html: string; text: string } {
  const facts = sampleCourtesyFacts(todayYmd)
  const text = courtesyEmailText(facts, who, courtesyGreeting(who === 'owner' ? SAMPLE_OWNER.name : SAMPLE_GC.contact))
  return { subject: who === 'owner' ? courtesyOwnerSubject(facts) : courtesySubject(facts), html: lienFilingEmailHtml(text), text }
}

/** Step 2 by text: the short reminder, the same facts. */
export function sampleCourtesyText(who: CourtesyWho, todayYmd: string): string {
  return courtesyTextBody(sampleCourtesyFacts(todayYmd), who)
}
