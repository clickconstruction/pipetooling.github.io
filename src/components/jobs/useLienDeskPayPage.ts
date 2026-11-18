import { useEffect, useMemo, type Dispatch, type MouseEvent, type RefObject, type SetStateAction } from 'react'
import type { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskJob } from '../../hooks/useLienDeskData'
import { useNoticePayPage } from '../../hooks/useNoticePayPage'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { lienUnbilled } from '../../lib/jobs/lienClaimBills'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import type { LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import { changedPayLines, payLineField, payLineInvoiceId, payPageBlocks } from '../../lib/jobs/lienNoticePayPage'
import type { LienPayOffer } from '../../lib/jobs/lienPayOffer'
import { filingDocHtml, type FilingDocExtras, type FilingFieldMark, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'

/** A pay line being typed in place: the bill, the words so far, and where its box sits over the page. */
export type LienPayLineEditing = { invoiceId: string; value: string; rect: { top: number; left: number; width: number; height: number }; font: string }

/** What the Lien desk hands the notice's pay page: the job on the pane, the notice as it stands, and the typed lines' state. */
export type LienDeskPayPageInput = {
  selected: LienDeskEntry | null
  job: LienDeskJob | undefined
  openBalance: number
  issuer: PhysicalInvoiceIssuer | null
  /** The desk re-reads after a write. */
  onChanged: () => void
  /** Bill Customer over the desk; null outside its provider. */
  billCustomer: ReturnType<typeof useBillCustomerModal>
  /** The notice's fields, its extras, the stored draft, the cover page's blocks and the pay offer, as the paper shows them. */
  noticeFields: LienNoticeFields
  docExtras: FilingDocExtras
  storedDraft: LienDeskDraftFields | null
  coverBlocks: ReadonlyArray<unknown>
  offer: LienPayOffer | null
  /** Sent for approval, or not the office's: the lines cannot be typed over. */
  wordingLocked: boolean
  /** The typed lines and the one being typed, kept by the desk (it clears them when the job changes), with the page and its input. */
  payLineEdits: Record<string, string>
  setPayLineEdits: Dispatch<SetStateAction<Record<string, string>>>
  payEditing: LienPayLineEditing | null
  setPayEditing: Dispatch<SetStateAction<LienPayLineEditing | null>>
  payPaperRef: RefObject<HTMLDivElement | null>
  payInputRef: RefObject<HTMLInputElement | null>
  /** Counts a change for the draft's autosave. */
  touchDraft: () => void
}

/**
 * The pay page behind a notice (punch list #35, PR 3; its own file since v2.7611, out of `LienDesk.tsx` as it
 * stood): the job's unpaid bills (`useNoticePayPage`), the part no sent bill carries and the press that bills it
 * from here (v2.4969), the page as the run prints it behind the owner's copy, and its lines typed in place
 * (v2.4724). The click handler measures the line against the page the desk draws, as it did.
 */
export function useLienDeskPayPage({ selected, job, openBalance, issuer, onChanged, billCustomer, noticeFields, docExtras, storedDraft, coverBlocks, offer, wordingLocked, payLineEdits, setPayLineEdits, payEditing, setPayEditing, payPaperRef, payInputRef, touchDraft }: LienDeskPayPageInput) {
  const { showToast } = useToastContext()
  const payPage = useNoticePayPage(selected?.jobId ?? null, true)
  // The bills behind the claim (v2.4969): the desk's money is what the sent bills still owe (`lien_billed_open()`), so the
  // claim and the pay page cannot disagree; the Months card lists the bills, and the part of the job no sent bill carries.
  const claimBills = payPage.bills
  const unbilled = job ? lienUnbilled(job, openBalance) : 0
  const billFromHere = () => {
    const j = payPage.job
    if (!billCustomer || !j || !selected) return
    if (!jobLedgerHasCustomerForBilling(j.customer_id)) {
      showToast('Link this job to a customer before billing.', 'error')
      return
    }
    const reread = async () => {
      payPage.refresh()
      onChanged()
    }
    billCustomer.openBillCustomer({ payload: { kind: 'job', job: jobBillingContextFromJob(j) }, onSuccess: reread, onAfterEnsureSuccess: reread })
  }
  const billWhy = !billCustomer ? 'Billing opens from the Pipeline on this screen' : !payPage.job ? (payPage.loading ? 'Reading the job’s bills…' : 'The job’s bills could not be read') : ''
  const payLinesNow = useMemo(() => ({ ...(storedDraft?.payLines ?? {}), ...payLineEdits }), [storedDraft?.payLines, payLineEdits])
  const payChanged = useMemo(() => changedPayLines(payPage.rows, payLinesNow), [payPage.rows, payLinesNow])
  const payChangedCount = Object.keys(payChanged).length
  const payBlocks = useMemo(
    () =>
      selected && payPage.rows.length
        ? payPageBlocks({
            rows: payPage.rows,
            assets: payPage.assets,
            copy: 'owner',
            copyLabel: '',
            gcName: noticeFields.originalContractorName,
            claimantName: noticeFields.claimantName,
            contactPerson: noticeFields.contactPerson,
            phone: (issuer?.phone ?? '').trim(),
            extras: docExtras,
            coverLetter: coverBlocks.length > 0,
            offer,
            lines: payLinesNow,
          })
        : [],
    [selected, payPage, noticeFields, issuer, docExtras, offer, payLinesNow, coverBlocks.length],
  )
  const payMarks = useMemo(() => {
    const m: Record<string, FilingFieldMark> = {}
    for (const r of payPage.rows) m[payLineField(r.invoiceId)] = { kind: wordingLocked ? 'locked' : 'typed', changed: r.invoiceId in payChanged, title: wordingLocked ? 'Sent for approval — pull it back to a draft to change it' : 'Click to change — on this page only, the bill keeps its own line' }
    return m
  }, [payPage.rows, payChanged, wordingLocked])
  const payHtml = useMemo(() => (payBlocks.length ? filingDocHtml(payBlocks, { marks: payMarks }) : ''), [payBlocks, payMarks])
  const onPayPaperClick = (ev: MouseEvent<HTMLDivElement>) => {
    const t = ev.target as HTMLElement
    const reset = payLineInvoiceId(t.closest<HTMLElement>('[data-reset]')?.getAttribute('data-reset') ?? '')
    if (reset) {
      if (!wordingLocked) {
        setPayLineEdits((e) => ({ ...e, [reset]: payPage.rows.find((r) => r.invoiceId === reset)?.description ?? '' }))
        touchDraft()
      }
      return
    }
    const el = t.closest<HTMLElement>('[data-field]')
    const id = payLineInvoiceId(el?.getAttribute('data-field') ?? '')
    const wrap = payPaperRef.current
    if (!el || !id || !wrap) return
    if (wordingLocked) {
      showToast('Sent for approval — pull it back to a draft to change the wording.', 'info')
      return
    }
    const r = el.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const cs = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null
    setPayEditing({ invoiceId: id, value: payLinesNow[id] ?? payPage.rows.find((x) => x.invoiceId === id)?.description ?? '', rect: { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height }, font: cs?.font ?? '' })
  }
  const commitPayEdit = () => {
    setPayEditing((e) => {
      if (e) {
        setPayLineEdits((x) => ({ ...x, [e.invoiceId]: e.value.trim() }))
        touchDraft()
      }
      return null
    })
  }
  useEffect(() => {
    if (payEditing) payInputRef.current?.focus()
  }, [payEditing?.invoiceId])
  return { payPage, claimBills, unbilled, billFromHere, billWhy, payLinesNow, payChanged, payChangedCount, payBlocks, payMarks, payHtml, onPayPaperClick, commitPayEdit }
}
