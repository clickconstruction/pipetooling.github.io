import { useCallback, useEffect, useMemo, useState } from 'react'
import { cleanStoredAddress } from '../../lib/displayAddress'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienAffidavitBlocks, buildLienNoticeBlocks, buildReleaseOfRecordBlocks, filingDocFooter, filingDocHtml, filingDocPdfBlob, filingDocPrintHtml, filingLetterheadFromIssuer, filingPdfFilename, type FilingDocBlock, type FilingDocExtras, type LienAffidavitFields, type LienNoticeFields, type ReleaseOfRecordFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { serveDueForFiling, liveFilings, type JobLienClock, type JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { documentLinkWords, filingDocumentPayload, normalizeDocumentUrl, type LienFilingDocument } from '../../lib/jobs/lienFilingDocumentLink'
import LienNoticeByHandPane from './LienNoticeByHandPane'
import {
  customerAddressLienGaps,
  lienPropertyOwnerDisplayName,
  resolveLienProperty,
  type CustomerAddressRow,
  type JobPropertyOwnerLike,
} from '../../lib/jobs/lienProperty'
import { openHtmlPreviewWindow, openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildDemandLetterPacket, mergePdfBlobs } from '../../lib/jobsDocuments/demandLetterPacket'
import { buildPhysicalInvoicePdfBlob } from '../../lib/physicalInvoicePdf'
import { payPageBlocks, payPageRows, type PayPageAssets } from '../../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../../lib/jobs/lienNoticePayPageAssets'
import { noticeEnclosureRefItem, noticeInvoiceExhibitInputs, noticeInvoicePrintSections, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { homesteadStatementApplies } from '../../lib/jobs/lienNoticeDraft'

/**
 * The statutory filing tabs of the Lien instruments modal (v2.2645, phase 3):
 * the § 53.056 notice (statute's form verbatim, per-recipient send records),
 * the § 53.054 affidavit behind the readiness gate (owner / county+legal /
 * recorded notice / homestead hard-stop), and the release of a recorded lien
 * once a filing exists. Documents come from `lienFilingDocuments.ts`; records
 * land in `job_lien_filings`. Amounts are job-level (contract = revenue, paid
 * = payments_made) — the affidavit swears the whole-job claim.
 */

const SEND_METHODS = ['certified_mail', 'traceable_courier', 'email', 'hand'] as const

const SEND_METHOD_LABELS: Record<string, string> = {
  certified_mail: 'certified mail, return receipt',
  traceable_courier: 'traceable courier',
  email: 'email',
  hand: 'hand delivery',
}

type SendDraft = { method: string; tracking: string; sentOn: string }

function todayYmd(): string {
  return todayYmdInAppTz()
}

function jobOpenBalance(job: JobWithDetails): number {
  return Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
}

export default function LienFilingTabs({
  job,
  jobNumber,
  activeTab,
  issuer,
  signerNameFallback,
  linkedAddress,
  jobOwnerRow,
  filings,
  clock,
  isSub,
  originalContractorName,
  ownerEmail,
  originalContractorEmail,
  onChanged,
  noticeMonths,
  invoiceDocs = [],
}: {
  job: JobWithDetails
  jobNumber: string
  activeTab: 'notice' | 'affidavit' | 'release_record'
  issuer: PhysicalInvoiceIssuer | null
  signerNameFallback: string
  linkedAddress: CustomerAddressRow | null
  jobOwnerRow: JobPropertyOwnerLike
  filings: JobLienFilingRow[]
  clock: JobLienClock
  isSub: boolean
  /** The GC when we're the sub; our own company when original contractor. */
  originalContractorName: string
  /** Courtesy-email addresses when known ('' hides the email option for that recipient). */
  ownerEmail: string
  originalContractorEmail: string
  onChanged: () => void
  /** Months the notice names (the Lien desk, v2.3405); null = the last work month, as before. */
  noticeMonths?: string[] | null
  /** The unpaid bills as documents (v2.3437) — enclosed behind the § 53.056 notice (§ 53.056(a-3)). */
  invoiceDocs?: NoticeInvoiceDoc[]
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [encloseInvoice, setEncloseInvoice] = useState(true)
  const enclosedDocs = useMemo(() => (encloseInvoice ? invoiceDocs : []), [encloseInvoice, invoiceDocs])
  const [voidPendingId, setVoidPendingId] = useState<string | null>(null)
  const [recordStep, setRecordStep] = useState<'notice_sends' | 'notice_by_hand' | 'affidavit_filing' | 'affidavit_service' | null>(null)
  const [ownerSend, setOwnerSend] = useState<SendDraft>({ method: 'certified_mail', tracking: '', sentOn: todayYmd() })
  const [ocSend, setOcSend] = useState<SendDraft>({ method: 'certified_mail', tracking: '', sentOn: todayYmd() })
  const [filingCounty, setFilingCounty] = useState('')
  // The saved copy (v2.3763): a link to the paper as sent or filed, typed with the record or added to a row later.
  const [docUrl, setDocUrl] = useState('')
  const [docNote, setDocNote] = useState('')
  const [docEditId, setDocEditId] = useState<string | null>(null)
  const [docEdit, setDocEdit] = useState<{ url: string; note: string }>({ url: '', note: '' })
  const [filingNumber, setFilingNumber] = useState('')
  const [filingDate, setFilingDate] = useState(todayYmd())
  const [serviceDate, setServiceDate] = useState(todayYmd())
  const [releasePaymentDate, setReleasePaymentDate] = useState(todayYmd())
  const [busy, setBusy] = useState(false)

  const property = useMemo(() => resolveLienProperty(linkedAddress, jobOwnerRow), [linkedAddress, jobOwnerRow])
  const live = useMemo(() => liveFilings(filings), [filings])
  const liveNotices = live.filter((f) => f.kind === 'notice_53_056')
  const filedAffidavit = live.find((f) => f.kind === 'affidavit' && f.filed_at) ?? null
  const anyAffidavit = live.find((f) => f.kind === 'affidavit') ?? null
  const openBalance = jobOpenBalance(job)
  const ownerName = lienPropertyOwnerDisplayName(property.owner)

  useEffect(() => {
    setRecordStep(null)
    setVoidPendingId(null)
    setFilingCounty(property.county)
  }, [activeTab, job.id, property.county])

  // ---------- documents ----------

  const noticeFields: LienNoticeFields = useMemo(
    () => ({
      noticeDate: todayYmd(),
      projectDescription: [job.job_name?.trim(), cleanStoredAddress(job.job_address)].filter(Boolean).join(' — '),
      claimantName: (issuer?.companyName ?? '').trim() || 'Click Plumbing and Electrical',
      laborMaterialsType: 'Plumbing labor and materials',
      originalContractorName,
      contractedWithIfDifferent: '',
      claimAmount: openBalance.toFixed(2),
      contactPerson: signerNameFallback,
      claimantAddress: (issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
      ...(homesteadStatementApplies(property) ? { homesteadStatement: true } : {}),
    }),
    [job, issuer, originalContractorName, openBalance, signerNameFallback, property],
  )

  const affidavitFields: LienAffidavitFields = useMemo(
    () => ({
      county: property.county,
      claimantPersonName: signerNameFallback,
      claimantCompany: (issuer?.companyName ?? '').trim() || 'Click Plumbing and Electrical',
      claimantAddress: (issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
      legalDescription: property.legalDescription,
      propertyAddress: cleanStoredAddress(job.job_address),
      contractedWithName: isSub ? originalContractorName : ownerName || (job.customer_name ?? '').trim(),
      workDescription: (job.job_name ?? '').trim() || 'Plumbing labor and materials',
      workStart: (job.last_work_date ?? '').slice(0, 10),
      workEnd: (job.last_work_date ?? '').slice(0, 10),
      ownerName,
      ownerAddress: property.owner.mailingAddress,
      originalContractorName,
      originalContractorAddress: '',
      contractAmount: Number(job.revenue ?? 0).toFixed(2),
      paidAmount: Number(job.payments_made ?? 0).toFixed(2),
      unpaidAmount: openBalance.toFixed(2),
      includeNoticesSworn: !isSub || liveNotices.length > 0,
    }),
    [property, signerNameFallback, issuer, job, isSub, originalContractorName, ownerName, openBalance, liveNotices.length],
  )

  const releaseFields: ReleaseOfRecordFields = useMemo(
    () => ({
      county: filedAffidavit?.county || property.county,
      claimantCompany: (issuer?.companyName ?? '').trim() || 'Click Plumbing and Electrical',
      claimantPersonName: signerNameFallback,
      recordingNumber: filedAffidavit?.recording_number ?? '',
      filedDate: filedAffidavit?.filed_at ?? '',
      legalDescription: property.legalDescription,
      propertyAddress: cleanStoredAddress(job.job_address),
      ownerName,
      paymentDate: releasePaymentDate,
    }),
    [filedAffidavit, property, issuer, signerNameFallback, job, ownerName, releasePaymentDate],
  )

  // Letterhead + reference strip (v2.2663): the same issuer block invoices use.
  const docExtras: FilingDocExtras = useMemo(
    () => ({
      letterhead: filingLetterheadFromIssuer(issuer),
      refItems: [
        `Job #${jobNumber}`,
        ...(noticeMonths && noticeMonths.length > 0 ? [`Work months ${noticeMonths.join(', ')}`] : clock.workMonth ? [`Work month ${clock.workMonth}`] : []),
        demandDate(todayYmd()),
        ...(activeTab === 'notice' && enclosedDocs.length > 0 ? [noticeEnclosureRefItem(enclosedDocs)] : []),
      ],
    }),
    [issuer, jobNumber, clock.workMonth, noticeMonths, activeTab, enclosedDocs],
  )

  // The pay page (v2.3758): one code per enclosed Stripe bill, behind the notice, in front of the invoices.
  const payRows = useMemo(() => payPageRows(enclosedDocs), [enclosedDocs])
  const [payAssets, setPayAssets] = useState<PayPageAssets>({})
  useEffect(() => {
    let cancelled = false
    if (!payRows.some((r) => r.payable)) {
      setPayAssets({})
      return
    }
    void buildPayPageAssets(payRows)
      .then((a) => {
        if (!cancelled) setPayAssets(a)
      })
      .catch(() => {
        if (!cancelled) setPayAssets({})
      })
    return () => {
      cancelled = true
    }
  }, [payRows])
  const payBlocks = useMemo(
    () =>
      payPageBlocks({
        rows: payRows,
        assets: payAssets,
        copy: 'owner',
        copyLabel: '',
        gcName: originalContractorName,
        claimantName: noticeFields.claimantName,
        contactPerson: noticeFields.contactPerson,
        phone: (issuer?.phone ?? '').trim(),
        extras: docExtras,
      }),
    [payRows, payAssets, originalContractorName, noticeFields.claimantName, noticeFields.contactPerson, issuer, docExtras],
  )
  const payPagePdf = useCallback(async (): Promise<Blob | null> => (payBlocks.length ? filingDocPdfBlob(payBlocks, { footer: filingDocFooter('notice_53_056') }) : null), [payBlocks])

  const currentDoc: { blocks: FilingDocBlock[]; title: string; kind: 'notice_53_056' | 'affidavit' | 'release_of_record' } | null = useMemo(() => {
    if (activeTab === 'notice') return { blocks: buildLienNoticeBlocks(noticeFields, docExtras), title: `§ 53.056 Notice — Job ${jobNumber}`, kind: 'notice_53_056' }
    if (activeTab === 'affidavit') return { blocks: buildLienAffidavitBlocks(affidavitFields, docExtras), title: `Lien Affidavit — Job ${jobNumber}`, kind: 'affidavit' }
    if (activeTab === 'release_record' && filedAffidavit) return { blocks: buildReleaseOfRecordBlocks(releaseFields, docExtras), title: `Release of Recorded Lien — Job ${jobNumber}`, kind: 'release_of_record' }
    return null
  }, [activeTab, noticeFields, affidavitFields, releaseFields, filedAffidavit, jobNumber, docExtras])

  // ---------- gates ----------

  const affidavitGates: { ok: boolean; label: string }[] = [
    { ok: Boolean(ownerName && property.owner.mailingAddress), label: ownerName ? `Owner of record — ${ownerName}${property.owner.mailingAddress ? '' : ' (mailing address missing)'}` : 'Owner of record with mailing address' },
    {
      ok: Boolean(property.county && property.legalDescription),
      label: property.county || property.legalDescription ? `County + legal description${linkedAddress ? ` — missing ${customerAddressLienGaps(linkedAddress).filter((g) => g !== 'owner of record' && g !== 'owner mailing address').join(', ') || 'nothing'}` : ''}` : 'County + legal description (link a property record)',
    },
    { ok: !isSub || liveNotices.length > 0, label: isSub ? `§ 53.056 notice recorded${liveNotices.length > 0 ? ` — ${liveNotices.length} on file` : ''}` : 'No monthly notice required (original contractor)' },
    { ok: !property.homestead, label: property.homestead ? 'Homestead: lien rights require a pre-work contract signed by both spouses and RECORDED with the county (§ 53.254) — the app cannot paper over this; talk to your attorney' : 'Not a homestead' },
  ]
  const affidavitReady = affidavitGates.every((g) => g.ok)
  const monthMatchWarning =
    isSub && liveNotices.length > 0 && clock.workMonth && !liveNotices.some((f) => (f.months_covered ?? []).includes(clock.workMonth))
      ? `No recorded notice names ${clock.workMonth} (the last work month) — confirm coverage before swearing ¶9.`
      : ''

  // ---------- actions ----------

  // The invoice behind the notice (v2.3437, § 53.056(a-3)): print pages after the notice, PDF pages merged behind it.
  const noticeEnclosureHtml = useCallback(
    (html: string): string => {
      if (!currentDoc || currentDoc.kind !== 'notice_53_056' || enclosedDocs.length === 0) return html
      const pay = payBlocks.length ? `<section style="page-break-before:always;margin-top:3rem">${filingDocHtml(payBlocks)}</section>` : ''
      const sections = noticeInvoicePrintSections(enclosedDocs)
        .map((sec) => `<section style="page-break-before:always;margin-top:3rem">${sec}</section>`)
        .join('')
      return html.replace('</body>', `${pay}${sections}</body>`)
    },
    [currentDoc, enclosedDocs, payBlocks],
  )
  const withNoticeEnclosure = useCallback(
    async (blob: Blob): Promise<Blob> => {
      if (!currentDoc || currentDoc.kind !== 'notice_53_056' || enclosedDocs.length === 0) return blob
      const pay = await payPagePdf()
      const notice = pay ? await mergePdfBlobs([blob, pay]) : blob
      const inputs = await noticeInvoiceExhibitInputs(enclosedDocs, buildPhysicalInvoicePdfBlob)
      return (await buildDemandLetterPacket(notice, inputs)).blob
    },
    [currentDoc, enclosedDocs, payPagePdf],
  )

  const printDoc = useCallback(() => {
    if (!currentDoc) return
    const ok = openHtmlPrintWindow(noticeEnclosureHtml(filingDocPrintHtml(currentDoc.blocks, currentDoc.title, filingDocFooter(currentDoc.kind))))
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
  }, [currentDoc, noticeEnclosureHtml, showToast])

  const downloadPdf = useCallback(async () => {
    if (!currentDoc || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await withNoticeEnclosure(await filingDocPdfBlob(currentDoc.blocks, { footer: filingDocFooter(currentDoc.kind) }))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filingPdfFilename(currentDoc.kind, jobNumber)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Could not build the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }, [currentDoc, jobNumber, pdfBusy, showToast, withNoticeEnclosure])

  const insertFiling = useCallback(
    async (payload: Record<string, unknown>, successMsg: string) => {
      if (busy) return
      setBusy(true)
      try {
        await withSupabaseRetry<{ id: string }>(
          () =>
            supabase
              .from('job_lien_filings')
              .insert({ job_id: job.id, created_by: authUser?.id ?? null, ...filingDocumentPayload({ url: docUrl, note: docNote }), ...payload } as never)
              .select('id')
              .single(),
          'record lien filing',
        )
        showToast(successMsg, 'success')
        setRecordStep(null)
        setDocUrl('')
        setDocNote('')
        onChanged()
      } catch {
        showToast('Could not save the record.', 'error')
      } finally {
        setBusy(false)
      }
    },
    [busy, job.id, authUser?.id, showToast, onChanged],
  )

  /** Email a recipient the notice PDF via the send-lien-filing-email edge fn; returns the resend id. */
  const emailNoticeTo = useCallback(
    async (toEmail: string, recipientLabel: string): Promise<string> => {
      const form = await filingDocPdfBlob(buildLienNoticeBlocks(noticeFields, docExtras), { footer: filingDocFooter('notice_53_056') })
      const pay = enclosedDocs.length > 0 ? await payPagePdf() : null
      const notice = pay ? await mergePdfBlobs([form, pay]) : form
      const blob = enclosedDocs.length > 0 ? (await buildDemandLetterPacket(notice, await noticeInvoiceExhibitInputs(enclosedDocs, buildPhysicalInvoicePdfBlob))).blob : notice
      const buf = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      const pdfBase64 = btoa(binary)
      const { data, error } = await supabase.functions.invoke('send-lien-filing-email', {
        body: {
          job_id: job.id,
          to_email: toEmail,
          recipient_label: recipientLabel,
          pdf_base64: pdfBase64,
          pdf_filename: filingPdfFilename('notice_53_056', jobNumber),
        },
      })
      if (error || (data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string } | null)?.error || 'send failed')
      }
      return ((data as { resend_email_id?: string | null } | null)?.resend_email_id ?? '') || 'sent'
    },
    [noticeFields, docExtras, enclosedDocs, job.id, jobNumber, payPagePdf],
  )

  const recordNoticeSends = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const finalSends: Array<Record<string, string>> = []
      for (const [recipient, draft, toEmail] of [
        ['owner', ownerSend, ownerEmail],
        ['original_contractor', ocSend, originalContractorEmail],
      ] as const) {
        let tracking = draft.tracking
        if (draft.method === 'email') {
          if (!toEmail) throw new Error(`No email on file for the ${recipient.replace(/_/g, ' ')}`)
          const resendId = await emailNoticeTo(toEmail, recipient)
          tracking = `resend:${resendId} → ${toEmail}`
        }
        finalSends.push({ recipient, method: draft.method, tracking, sent_on: draft.sentOn })
      }
      await withSupabaseRetry<{ id: string }>(
        () =>
          supabase
            .from('job_lien_filings')
            .insert({
              job_id: job.id,
              created_by: authUser?.id ?? null,
              kind: 'notice_53_056',
              amount: openBalance,
              months_covered: noticeMonths && noticeMonths.length > 0 ? noticeMonths : clock.workMonth ? [clock.workMonth] : [],
              fields: JSON.parse(JSON.stringify(noticeFields)),
              sends: finalSends,
              ...filingDocumentPayload({ url: docUrl, note: docNote }),
            } as never)
            .select('id')
            .single(),
        'record lien notice',
      )
      showToast('Notice recorded for both recipients — the notice watch is satisfied for this month.', 'success')
      setRecordStep(null)
      setDocUrl('')
      setDocNote('')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : 'Could not record the notice.', 'error')
    } finally {
      setBusy(false)
    }
  }, [busy, ownerSend, ocSend, ownerEmail, originalContractorEmail, emailNoticeTo, job.id, authUser?.id, openBalance, clock.workMonth, noticeMonths, noticeFields, showToast, onChanged])

  const recordAffidavitFiling = () =>
    insertFiling(
      {
        kind: 'affidavit',
        amount: openBalance,
        fields: JSON.parse(JSON.stringify(affidavitFields)),
        county: filingCounty.trim(),
        recording_number: filingNumber.trim(),
        filed_at: filingDate || null,
        serve_due: filingDate ? serveDueForFiling(filingDate) : null,
      },
      `Filing recorded — serve the owner and contractor by ${demandDate(serveDueForFiling(filingDate))}.`,
    )

  const recordService = useCallback(async () => {
    if (!filedAffidavit || busy) return
    setBusy(true)
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_filings').update({ served_at: serviceDate || null }).eq('id', filedAffidavit.id),
        'record lien service',
      )
      showToast('Service recorded — the serve-by watch is cleared.', 'success')
      setRecordStep(null)
      onChanged()
    } catch {
      showToast('Could not record the service.', 'error')
    } finally {
      setBusy(false)
    }
  }, [filedAffidavit, busy, serviceDate, showToast, onChanged])

  const recordRelease = () =>
    insertFiling(
      {
        kind: 'release_of_record',
        amount: 0,
        fields: JSON.parse(JSON.stringify(releaseFields)),
        county: releaseFields.county,
        recording_number: releaseFields.recordingNumber,
      },
      'Release of the recorded lien saved — file it with the County Clerk.',
    )

  /** The saved-copy inputs on every record step (v2.3763): a Drive link and a line, both optional. */
  const savedCopyRow = (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(160px, 2fr) minmax(110px, 1fr)', gap: '0.35rem 0.5rem', alignItems: 'center', fontSize: '0.75rem', margin: '0.45rem 0' }} data-testid="filing-saved-copy">
      <span title="Where the paper lives once you saved it — a Drive link. The record carries it, so the copy can be found from the job later.">Saved copy</span>
      <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="Drive link (optional)" aria-label="Saved copy — link" style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }} />
      <input type="text" value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="note (optional)" aria-label="Saved copy — note" style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }} />
    </div>
  )
  /** Add or change the saved copy on a recorded filing (v2.3763) — the run's link is often typed later, once the scan is in Drive. */
  const saveFilingDocument = async (f: JobLienFilingRow) => {
    if (busy) return
    setBusy(true)
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_filings').update(filingDocumentPayload(docEdit, { clear: true }) as never).eq('id', f.id),
        'save lien filing document link',
      )
      showToast(normalizeDocumentUrl(docEdit.url) ? 'Saved copy linked.' : 'Saved copy cleared.', 'success')
      setDocEditId(null)
      onChanged()
    } catch {
      showToast('Could not save the link.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const viewFiling = (f: JobLienFilingRow) => {
    const snap = f.fields as unknown
    // Recorded rows re-render with the delivery record their sends captured.
    const sends = Array.isArray(f.sends) ? (f.sends as { recipient?: string; method?: string; tracking?: string; sent_on?: string }[]) : []
    const snapExtras: FilingDocExtras = {
      ...docExtras,
      refItems: [`Job #${jobNumber}`, ...((f.months_covered ?? []).length > 0 ? [`Work month ${(f.months_covered ?? []).join(', ')}`] : []), demandDate(f.created_at?.slice(0, 10) ?? '')],
      deliveryLines: sends.map(
        (s) => `${s.recipient === 'owner' ? 'Owner of record' : 'Original contractor'} — ${SEND_METHOD_LABELS[s.method ?? ''] ?? s.method ?? '—'}${s.tracking ? ` · ${s.tracking}` : ''}${s.sent_on ? ` · ${demandDate(s.sent_on)}` : ''}`,
      ),
    }
    let blocks: FilingDocBlock[] | null = null
    let kind: 'notice_53_056' | 'retainage_53_057' | 'affidavit' | 'release_of_record' = 'notice_53_056'
    if (snap && typeof snap === 'object') {
      if (f.kind === 'notice_53_056') blocks = buildLienNoticeBlocks(snap as LienNoticeFields, snapExtras)
      else if (f.kind === 'retainage_53_057') {
        blocks = buildLienNoticeBlocks(snap as LienNoticeFields, snapExtras, { instrument: 'retainage_53_057' })
        kind = 'retainage_53_057'
      } else if (f.kind === 'affidavit') {
        blocks = buildLienAffidavitBlocks(snap as LienAffidavitFields, snapExtras)
        kind = 'affidavit'
      } else if (f.kind === 'release_of_record') {
        blocks = buildReleaseOfRecordBlocks(snap as ReleaseOfRecordFields, snapExtras)
        kind = 'release_of_record'
      }
    }
    if (!blocks) {
      showToast('This record has no stored document snapshot.', 'error')
      return
    }
    const ok = openHtmlPreviewWindow(filingDocPrintHtml(blocks, `Lien filing — Job ${jobNumber}`, filingDocFooter(kind)))
    if (!ok) showToast('Popup blocked — allow popups to view the document.', 'error')
  }

  const voidFiling = async (f: JobLienFilingRow) => {
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_filings').update({ voided_at: new Date().toISOString() }).eq('id', f.id),
        'void lien filing',
      )
      showToast('Record voided.', 'success')
      setVoidPendingId(null)
      onChanged()
    } catch {
      showToast('Could not void the record.', 'error')
    }
  }

  // ---------- render helpers ----------

  const kindLabel = (k: string) =>
    k === 'notice_53_056' ? '§ 53.056 notice' : k === 'retainage_53_057' ? '§ 53.057 retainage notice' : k === 'affidavit' ? 'Lien affidavit' : 'Release of record'

  const sendRow = (label: string, draft: SendDraft, set: (d: SendDraft) => void, knownEmail?: string) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '9.5rem' }}>{label}</span>
      <select value={draft.method} onChange={(e) => set({ ...draft, method: e.target.value })} aria-label={`${label} send method`} style={{ padding: '0.3rem 0.35rem', fontSize: '0.78rem' }}>
        {SEND_METHODS.map((m) => (
          <option key={m} value={m}>
            {m.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <input type="text" value={draft.tracking} onChange={(e) => set({ ...draft, tracking: e.target.value })} placeholder="tracking #" aria-label={`${label} tracking number`} style={{ flex: '1 1 8rem', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
      <input type="date" value={draft.sentOn} onChange={(e) => set({ ...draft, sentOn: e.target.value })} aria-label={`${label} sent on`} style={{ padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
      {draft.method === 'email' ? (
        <span style={{ fontSize: '0.7rem', color: knownEmail ? 'var(--text-muted)' : 'var(--text-red-700)', flexBasis: '100%' }}>
          {knownEmail ? `sends the notice PDF to ${knownEmail} on Record` : 'no email on file for this recipient'}
        </span>
      ) : null}
    </div>
  )

  const historyBox = live.length > 0 && (
    <div style={{ margin: '0 0 0.9rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>Filings on this job</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {live.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>
            <span style={{ fontWeight: 700 }}>{kindLabel(f.kind)}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {f.kind === 'notice_53_056' && (f.months_covered ?? []).length > 0 ? `covers ${(f.months_covered ?? []).join(', ')} · ` : ''}
              {f.kind === 'affidavit' && f.filed_at ? `filed ${demandDate(f.filed_at)} · #${f.recording_number || '—'} · ${f.served_at ? `served ${demandDate(f.served_at)}` : `serve by ${demandDate(f.serve_due ?? '')}`}` : ''}
              {f.kind === 'notice_53_056' || f.kind === 'retainage_53_057' ? demandMoney(String(f.amount ?? '')) : ''}
            </span>
            {(() => {
              const doc = f as unknown as LienFilingDocument
              const url = normalizeDocumentUrl(doc.document_url)
              const words = documentLinkWords(doc)
              if (docEditId === f.id) {
                return (
                  <span style={{ flexBasis: '100%', display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) minmax(100px, 1fr) auto auto', gap: '0.35rem', alignItems: 'center' }} data-testid="filing-document-edit">
                    <input type="text" value={docEdit.url} onChange={(e) => setDocEdit((d) => ({ ...d, url: e.target.value }))} placeholder="Drive link" aria-label="Saved copy — link" style={{ padding: '0.25rem 0.4rem', fontSize: '0.72rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }} />
                    <input type="text" value={docEdit.note} onChange={(e) => setDocEdit((d) => ({ ...d, note: e.target.value }))} placeholder="note" aria-label="Saved copy — note" style={{ padding: '0.25rem 0.4rem', fontSize: '0.72rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }} />
                    <button type="button" onClick={() => void saveFilingDocument(f)} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>Save</button>
                    <button type="button" onClick={() => setDocEditId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>Cancel</button>
                  </span>
                )
              }
              return (
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }} data-testid="filing-document">
                  {url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>{words} ›</a> : words ? <span style={{ color: 'var(--text-muted)' }}>{words}</span> : null}
                  <button type="button" onClick={() => { setDocEditId(f.id); setDocEdit({ url: doc.document_url ?? '', note: doc.document_note ?? '' }) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.72rem', textDecoration: 'underline dotted' }}>
                    {url || words ? 'change' : 'link the saved copy'}
                  </button>
                </span>
              )
            })()}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => viewFiling(f)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                View
              </button>
              {voidPendingId === f.id ? (
                <button type="button" onClick={() => void voidFiling(f)} style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                  Confirm void
                </button>
              ) : (
                <button type="button" onClick={() => setVoidPendingId(f.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                  Void
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  const preview = currentDoc && (
    <div data-theme="light" style={{ flex: '1 1 20rem', minWidth: '18rem', padding: '1.1rem', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)' }}>
      <div
        style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.1rem 1.25rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.75rem', lineHeight: 1.65, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
        // Rendered from the same block walker as print/PDF — no user HTML.
        dangerouslySetInnerHTML={{ __html: filingDocHtml(currentDoc.blocks) }}
      />
    </div>
  )

  // ---------- tab bodies ----------

  if (activeTab === 'notice') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
        <div style={{ flex: '1 1 20rem', minWidth: '18rem', padding: '1rem 1.25rem' }}>
          {historyBox}
          {!isSub ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No monthly notice required — this job has no GC on file, so you contracted with the owner (original
              contractor). The affidavit window still applies; see the Mechanic's lien tab.
            </p>
          ) : (
            <>
              <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.75rem', marginBottom: '0.8rem' }}>
                <b>Role: subcontractor</b> — GC {originalContractorName || '—'}. Unpaid months need this notice by the
                15th of the {property.propertyKind === 'residential' ? '2nd' : '3rd'} month after the work
                {clock.noticeDeadline ? ` — ${clock.workMonth} is due ${demandDate(clock.noticeDeadline)}` : ''}.
              </div>
              <div style={{ fontSize: '0.8125rem', marginBottom: '0.6rem' }}>
                <b>Claim amount:</b> {demandMoney(String(openBalance))} (open on the job)
                <br />
                <b>Owner of record:</b> {ownerName || '—'} {property.owner.mailingAddress ? `· ${property.owner.mailingAddress}` : '· mailing address missing'}
                <br />
                <b>Original contractor:</b> {originalContractorName || '—'}
              </div>
              {invoiceDocs.length > 0 ? (
                <label data-notice-enclose-invoice style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={encloseInvoice} onChange={(e) => setEncloseInvoice(e.target.checked)} style={{ marginTop: '0.2rem' }} />
                  <span>
                    Enclose the {invoiceDocs.length === 1 ? 'invoice' : `${invoiceDocs.length} invoices`} — {invoiceDocs.map((d) => d.title).join(', ')}
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>§ 53.056(a-3) lets the notice include an invoice or billing statement; it prints after the notice and rides the emailed PDF, stamped INVOICE.</span>
                  </span>
                </label>
              ) : null}
              {recordStep === 'notice_sends' ? (
                <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem' }}>Record the sends — the statute names both recipients</div>
                  {sendRow('Owner', ownerSend, setOwnerSend, ownerEmail)}
                  {sendRow('Original contractor', ocSend, setOcSend, originalContractorEmail)}
                  {savedCopyRow}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <button type="button" onClick={() => setRecordStep(null)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                      Back
                    </button>
                    <button type="button" onClick={() => void recordNoticeSends()} disabled={busy} style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
                      {busy ? 'Saving…' : 'Record both sends'}
                    </button>
                  </div>
                </div>
              ) : recordStep === 'notice_by_hand' ? (
                <LienNoticeByHandPane
                  job={{ id: job.id, label: `${jobNumber} · ${(job.job_name ?? '').trim() || (job.job_address ?? '').trim()}`, jobAddress: job.job_address ?? null, customerAddressId: job.customer_address_id ?? null, amount: openBalance, itemId: null }}
                  fields={noticeFields}
                  appClaim={openBalance}
                  appClaimIsTimely={false}
                  defaultMonths={noticeMonths && noticeMonths.length > 0 ? noticeMonths : clock.workMonth ? [clock.workMonth] : []}
                  todayYmd={todayYmd()}
                  userId={authUser?.id ?? null}
                  onClose={() => setRecordStep(null)}
                  onRecorded={() => {
                    setRecordStep(null)
                    onChanged()
                  }}
                />
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={printDoc} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}>
                    Print
                  </button>
                  <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
                    {pdfBusy ? 'Building…' : 'Download PDF'}
                  </button>
                  <button type="button" onClick={() => setRecordStep('notice_sends')} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                    Save &amp; record sends…
                  </button>
                  <button type="button" onClick={() => setRecordStep('notice_by_hand')} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer' }} title="The paper was printed here and already went out by hand — record when, how, what it claimed, and which jobs at the property it covered" data-testid="notice-by-hand-door">
                    Already sent — record it…
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {isSub ? preview : null}
      </div>
    )
  }

  if (activeTab === 'affidavit') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
        <div style={{ flex: '1 1 20rem', minWidth: '18rem', padding: '1rem 1.25rem' }}>
          {historyBox}
          <div style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.55rem 0.7rem', marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.35rem' }}>Before this affidavit can be generated</div>
            {affidavitGates.map((g, i) => (
              <div key={i} style={{ fontSize: '0.75rem', margin: '0.15rem 0', color: g.ok ? 'var(--text-green-700)' : 'var(--text-amber-700)', fontWeight: g.ok ? 500 : 700 }}>
                {g.ok ? '✓' : '✗'} {g.label}
              </div>
            ))}
            {monthMatchWarning ? <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-700)', marginTop: '0.3rem' }}>⚠ {monthMatchWarning}</div> : null}
            {clock.filingDeadline ? <div style={{ fontSize: '0.72rem', color: 'var(--text-red-700)', marginTop: '0.3rem', fontWeight: 700 }}>Filing window for {clock.workMonth} work runs through {demandDate(clock.filingDeadline)} (§ 53.052).</div> : null}
          </div>
          {affidavitReady ? (
            <>
              <div style={{ fontSize: '0.8125rem', marginBottom: '0.6rem' }}>
                <b>Sworn amounts (¶8):</b> contract {demandMoney(affidavitFields.contractAmount)} · paid {demandMoney(affidavitFields.paidAmount)} · <b>unpaid {demandMoney(affidavitFields.unpaidAmount)}</b>
              </div>
              {recordStep === 'affidavit_filing' ? (
                <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem' }}>Record the filing (after the County Clerk stamps it)</div>
                  {savedCopyRow}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: '0.75rem' }}>
                      County
                      <input type="text" value={filingCounty} onChange={(e) => setFilingCounty(e.target.value)} style={{ display: 'block', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </label>
                    <label style={{ fontSize: '0.75rem' }}>
                      Recording #
                      <input type="text" value={filingNumber} onChange={(e) => setFilingNumber(e.target.value)} placeholder="2026-…" style={{ display: 'block', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </label>
                    <label style={{ fontSize: '0.75rem' }}>
                      Filed on
                      <input type="date" value={filingDate} onChange={(e) => setFilingDate(e.target.value)} style={{ display: 'block', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </label>
                    <button type="button" onClick={() => setRecordStep(null)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                      Back
                    </button>
                    <button type="button" onClick={() => void recordAffidavitFiling()} disabled={busy} style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', background: '#8C1D2F', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
                      {busy ? 'Saving…' : 'Record filing'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Serve-by stamps automatically: 5th calendar day after filing (§ 53.055), weekend-rolled.
                  </div>
                </div>
              ) : recordStep === 'affidavit_service' && filedAffidavit ? (
                <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem' }}>
                    Record service of the filed copy (due {demandDate(filedAffidavit.serve_due ?? '')})
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.75rem' }}>
                      Served on
                      <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} style={{ display: 'block', padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </label>
                    <button type="button" onClick={() => setRecordStep(null)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                      Back
                    </button>
                    <button type="button" onClick={() => void recordService()} disabled={busy} style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', background: '#8C1D2F', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
                      {busy ? 'Saving…' : 'Record service'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={printDoc} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}>
                    Print for notarization
                  </button>
                  <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
                    {pdfBusy ? 'Building…' : 'Download PDF'}
                  </button>
                  {!anyAffidavit ? (
                    <button type="button" onClick={() => setRecordStep('affidavit_filing')} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', background: '#8C1D2F', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                      Record filing…
                    </button>
                  ) : filedAffidavit && !filedAffidavit.served_at ? (
                    <button type="button" onClick={() => setRecordStep('affidavit_service')} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', background: '#8C1D2F', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                      Record service…
                    </button>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Clear the ✗ items above — each links back to where the fix lives (the customer's address book for
              property facts, the § 53.056 tab for the notice).
            </p>
          )}
        </div>
        {affidavitReady ? preview : null}
      </div>
    )
  }

  // release_record
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
      <div style={{ flex: '1 1 20rem', minWidth: '18rem', padding: '1rem 1.25rem' }}>
        {historyBox}
        {!filedAffidavit ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            No recorded lien on this job — this release becomes available once an affidavit filing is recorded.
          </p>
        ) : (
          <>
            <div style={{ fontSize: '0.8125rem', marginBottom: '0.6rem' }}>
              <b>Releasing:</b> instrument #{filedAffidavit.recording_number || '—'} · filed {demandDate(filedAffidavit.filed_at ?? '')} · {filedAffidavit.county || property.county} County
            </div>
            <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: '0.7rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Payment / satisfaction date</span>
              <input type="date" value={releasePaymentDate} onChange={(e) => setReleasePaymentDate(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
            </label>
            {savedCopyRow}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={printDoc} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}>
                Print for notarization
              </button>
              <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
                {pdfBusy ? 'Building…' : 'Download PDF'}
              </button>
              <button type="button" onClick={() => void recordRelease()} disabled={busy} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
                {busy ? 'Saving…' : 'Save release record'}
              </button>
            </div>
          </>
        )}
      </div>
      {filedAffidavit ? preview : null}
    </div>
  )
}
