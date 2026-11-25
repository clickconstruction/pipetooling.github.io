import { useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { countedLabel } from '../../lib/batchWords'
import { demandDate } from '../../lib/jobsDocuments/demandDate'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'
import { markLienDeskItemsPrinted } from '../../lib/jobs/lienDeskIo'
import type { LienGetItRight } from '../../lib/jobs/lienGetItRight'
import { lienRunGuideCode } from '../../lib/jobs/lienHelpGuideCode'
import type { LienHelpLeftOut } from '../../lib/jobs/lienHelpSheet'
import { lienLeaveOutReasonWords } from '../../lib/jobs/lienLeftOut'
import { lienRunReadyNotices, lienRunReadyPacket } from '../../lib/jobs/lienRunPacket'
import { LIEN_RUN_PRINT_WORDS, lienRunPrintedWords, lienRunPrintPlan, lienRunPrintPress, type LienRunPrintPress } from '../../lib/jobs/lienRunPrint'
import { lienRunStackHtml, lienStackBrowserCan, lienStackDividerWords, lienStackOrderWords } from '../../lib/jobs/lienRunStack'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import type { SentFiling } from '../../lib/sent/sentCopies'
import { useLienRunEnclosures } from './useLienRunEnclosures'

/** The affidavits' batch as its own press builds it: the one document, and the copy each job files. */
export type LienRunAffidavitsRun = { html: string; copies: Array<{ filing: Omit<SentFiling, 'how'>; html: string }> }

export type LienRunPrintHookInput = {
  run: LienGetItRight | null
  /** The checklist is open: nothing is read or built before then. */
  open: boolean
  /** The desk's monthly notices, as it hands them to the run window. Called only while the checklist is open. */
  noticesFor: () => RunNotice[]
  /** How many affidavits the batch prints for these jobs. */
  affidavitCount: (jobIds: ReadonlySet<string>) => number
  /** The batch for these jobs, with what its help sheet names as left out; null when it prints nothing. */
  affidavitsRun: (run: { jobIds: ReadonlySet<string>; leftOut: ReadonlyArray<LienHelpLeftOut> }) => LienRunAffidavitsRun | null
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  stripeMode: BillingStripeModePref
  userId: string | null
  /** The desk reads again: the printed notices move to their bin. */
  onChanged: () => void
}

export type LienRunPrintState = {
  press: LienRunPrintPress
  /** The stack's order as a sentence, each count a value; '' with nothing to print. */
  order: string
  /** `one`: the one press. `two`: both kinds are in the run and this browser cannot hold them in one print job. */
  mode: 'one' | 'two'
  /** Why there are two presses, when there are. */
  twoWhy: string | null
  /** The two presses' words, when there are two. */
  parts: { notices: string; affidavits: string }
  notices: number
  affidavits: number
  /** What the press printed in this sitting, as a sentence; null before a print. */
  printed: { words: string; next: string | null } | null
  print: (which?: 'all' | 'notices' | 'affidavits') => void
}

const timeWords = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/**
 * The run's one print (punch list #362, step 6), less its drawing: what the press takes from the checklist, the read
 * of the notices' enclosures while the checklist is open, the count on the press, and the press itself, which builds
 * the stack, prints it, files each paper's copy as its own press files it, and stamps the notices printed.
 *
 * The documents are built at the press, never on a render. The count comes from the same kernels with no document.
 */
export function useLienRunPrint({ run, open, noticesFor, affidavitCount, affidavitsRun, issuer, todayYmd, stripeMode, userId, onChanged }: LienRunPrintHookInput): LienRunPrintState | null {
  const { showToast } = useToastContext()
  const [printed, setPrinted] = useState<LienRunPrintState['printed']>(null)
  const [refused, setRefused] = useState(false)
  const canStack = useMemo(() => lienStackBrowserCan(), [])

  const plan = run ? lienRunPrintPlan(run, (l) => (l.leftOut ? lienLeaveOutReasonWords(l.leftOut) : '')) : null
  const live = open && plan != null
  // The run's notices: the jobs the checklist counts as right and to print, and no other. A left-out paper is never here.
  const notices = live && plan.noticeJobIds.size > 0 ? noticesFor().filter((n) => plan.noticeJobIds.has(n.jobId)) : []
  const ready = notices.length > 0 ? lienRunReadyNotices(notices) : []
  // The enclosures are read by job, and the list keeps its identity while the jobs are the same: the desk builds the
  // notices anew on every render, and a read that followed them would never end.
  const jobKey = Array.from(new Set(notices.map((n) => n.jobId))).sort().join('\n')
  const enclosureJobs = useMemo(() => (jobKey ? jobKey.split('\n').map((jobId) => ({ jobId })) : []), [jobKey])
  const enclosures = useLienRunEnclosures(enclosureJobs, stripeMode, enclosureJobs.length > 0)

  if (!run || !plan) return null
  const noticeCount = ready.length
  const affidavits = live && plan.affidavitJobIds.size > 0 ? affidavitCount(plan.affidavitJobIds) : 0
  const reading = noticeCount > 0 && !enclosures.read
  const press = lienRunPrintPress({ notices: noticeCount, affidavits, held: plan.held, reading })
  const both = noticeCount > 0 && affidavits > 0
  const mode: 'one' | 'two' = both && (!canStack || refused) ? 'two' : 'one'

  const print = (which: 'all' | 'notices' | 'affidavits' = 'all') => {
    if (reading) return
    const packet = which !== 'affidavits' && notices.length > 0 ? lienRunReadyPacket({ notices, todayYmd, issuer, enclosures, guideCode: lienRunGuideCode() }) : null
    const batch = which !== 'notices' && plan.affidavitJobIds.size > 0 ? affidavitsRun({ jobIds: plan.affidavitJobIds, leftOut: plan.affidavitLeftOut }) : null
    if (!packet && !batch) return
    const dayWords = demandDate(todayYmd)
    const html = lienRunStackHtml({
      noticesHtml: packet?.html ?? null,
      affidavitsHtml: batch?.html ?? null,
      divider: lienStackDividerWords({ notices: packet?.notices.length ?? 0, affidavits: batch?.copies.length ?? 0, dayWords }),
      title: `The run — ${dayWords}`,
    })
    if (!html) {
      // Both papers are here and the merge did not know one of them: nothing printed, and each gets its own press.
      setRefused(true)
      return
    }
    if (!openHtmlPrintWindow(html)) {
      showToast(LIEN_RUN_PRINT_WORDS.blocked, 'error')
      return
    }
    // A print counts as a send (docs/SENT_COPIES.md). Each paper is filed as its own press files it: the notices as
    // one packet on every job in it, each affidavit alone on its job.
    if (packet) void fileSentCopy({ ...packet.filing, how: 'print' }, { html: packet.html })
    if (batch) for (const copy of batch.copies) void fileSentCopy({ ...copy.filing, how: 'print' }, { html: copy.html })
    setPrinted({
      words: lienRunPrintedWords({ notices: packet?.notices.length ?? 0, affidavits: batch?.copies.length ?? 0, atWords: timeWords(new Date()) }),
      next: packet && batch ? LIEN_RUN_PRINT_WORDS.next : packet ? LIEN_RUN_PRINT_WORDS.nextNotices : LIEN_RUN_PRINT_WORDS.nextAffidavits,
    })
    // Printed is a state (v2.4119): the notices move to their own bin until the mailing is recorded. Best effort, as the run window's stamp is.
    if (packet && packet.stampIds.length > 0) void markLienDeskItemsPrinted(packet.stampIds, userId).catch(() => undefined).then(onChanged)
  }

  return {
    press,
    order: lienStackOrderWords(noticeCount, affidavits, mode === 'one'),
    mode,
    twoWhy: mode === 'two' ? (refused ? LIEN_RUN_PRINT_WORDS.cannotStack : LIEN_RUN_PRINT_WORDS.twoPrints) : null,
    parts: { notices: countedLabel('Print', noticeCount, ['notice', 'notices']), affidavits: countedLabel('Print', affidavits, ['affidavit', 'affidavits']) },
    notices: noticeCount,
    affidavits,
    printed,
    print,
  }
}
