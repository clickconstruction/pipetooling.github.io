/**
 * Job Mode's **I'm here** (v2.5573, punch list #112): the press while on the way. The arrival is stamped the moment the
 * sheet opens, since the stamp is the data; then, when the customer can be texted, the office's I'm here line shows
 * in the orange box with the text as a choice. When no text can go the sheet says so in a toast and closes itself.
 * The rules are `lib/jobMode/onMyWay.ts`; the reads and the stamp are `lib/jobModeOnMyWayIo.ts`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import { jobModeFills, previewOf, type JobModeBlock } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer } from '../../lib/jobModeMessageCustomerIo'
import { supabaseOnMyWayIo, type OnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import { jobModeMessagesOffered } from '../../lib/messages/jobBox'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { PhoneLine } from '../../lib/quickReplies/phone'
import { acts, driveMinutes, ON_MY_WAY_WORDS, pressLine, textHold, type TravelFacts } from '../../lib/jobMode/onMyWay'
import * as S from './sheetStyles'

/** The press's row in `ui_nav_clicks`: `#text` or `#no-text`. */
export const IM_HERE_CONTROL = 'job_mode_im_here'

export interface ImHereSheetProps {
  sessionId: string
  jobId: string
  /** "PLUM 512 · Whitfield water heater" */
  jobLabel: string
  jobName: string | null
  jobAddress: string | null
  userId: string
  me: string | null
  role: UserRole | null | undefined
  /** The session's stamps as the card read them, for the drive's minutes. */
  travelFacts: TravelFacts | null
  /** After the stamp and any text: the card reads the session and Job updates again. */
  onDone: () => void
  onClose: () => void
  io?: OnMyWayIo
  today?: string
  now?: () => number
}

const firstOf = (name: string | null) => name?.trim().split(/\s+/)[0] || null

export function ImHereSheet({ sessionId, jobId, jobLabel, jobName, jobAddress, userId, me, role, travelFacts, onDone, onClose, io: ioProp, today = scheduleTodayDateKey(), now = Date.now }: ImHereSheetProps) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseOnMyWayIo(), [ioProp])
  const [read, setRead] = useState<{ customer: JobModeCustomer; lines: PhoneLine[]; textsOn: boolean; blocks: JobModeBlock[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const drive = useMemo(() => driveMinutes(travelFacts, now()), [travelFacts, now])
  const finished = useRef(false)

  const finish = (words: string, tone: 'success' | 'error' = 'success') => {
    if (finished.current) return
    finished.current = true
    showToast(words, tone)
    onDone()
    onClose()
  }

  // The stamp first, then what the text needs.
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        await io.arrive(sessionId)
      } catch (e) {
        if (live) finish(formatErrorMessage(e, 'Could not mark you on site.'), 'error')
        return
      }
      try {
        const [customer, lines, textsOn, blocks] = await Promise.all([io.loadCustomer(jobId), io.loadPressLines(), io.loadTextsOn(), io.loadBlocks(jobId, userId, today).catch(() => [])])
        if (!live) return
        const line = pressLine(lines, 'im_here')
        const hold = textHold({ offered: jobModeMessagesOffered(role), hasCustomer: Boolean(customer.customerId), textsOn, line })
        if (hold) {
          recordNavClick(userId, role ?? null, IM_HERE_CONTROL, '#no-text')
          finish(ON_MY_WAY_WORDS.arrived(drive))
          return
        }
        setRead({ customer, lines, textsOn, blocks })
      } catch {
        if (live) {
          recordNavClick(userId, role ?? null, IM_HERE_CONTROL, '#no-text')
          finish(ON_MY_WAY_WORDS.arrived(drive))
        }
      }
    })()
    return () => {
      live = false
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const first = firstOf(read?.customer.customerName ?? null)
  const line = read ? pressLine(read.lines, 'im_here') : null
  const fills = useMemo(
    () => jobModeFills({ customerName: read?.customer.customerName ?? null, me, jobName, jobAddress, blocks: read?.blocks ?? [], today }),
    [read?.customer.customerName, read?.blocks, me, jobName, jobAddress, today],
  )
  const preview = line ? previewOf(line, fills, {}, read?.customer.lang ?? 'en') : null
  const a = acts({ press: 'im_here', jobLabel, first, leaving: null, hold: null, sameSite: false, driveMinutes: drive })

  const noText = () => {
    recordNavClick(userId, role ?? null, IM_HERE_CONTROL, '#no-text')
    finish(ON_MY_WAY_WORDS.arrived(drive))
  }
  const text = async () => {
    if (!read?.customer.customerId || !line || busy) return
    setBusy(true)
    try {
      await io.send({ from: 'job_mode', customerId: read.customer.customerId, contactId: read.customer.contactId, jobId, quickReplyId: line.id, fills: {} })
      recordNavClick(userId, role ?? null, IM_HERE_CONTROL, '#text')
      finish(`${ON_MY_WAY_WORDS.arrived(drive)} ${ON_MY_WAY_WORDS.sent(first)}`)
    } catch (e) {
      showToast(formatErrorMessage(e, ON_MY_WAY_WORDS.hereTextFailed), 'error')
      finish(ON_MY_WAY_WORDS.arrived(drive), 'success')
    } finally {
      setBusy(false)
    }
  }

  const footer = read ? (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} disabled={busy} onClick={noText} data-testid="im-here-no-text">
        {a.secondary}
      </button>
      <button type="button" style={busy || preview?.stop ? { ...S.hereBtn, ...S.disabled } : S.hereBtn} disabled={busy || Boolean(preview?.stop)} onClick={() => void text()} data-testid="im-here-text">
        {busy ? 'Sending…' : a.primary}
      </button>
    </div>
  ) : undefined

  return (
    <ResponsiveModalShell title={ON_MY_WAY_WORDS.hereTitle} onRequestClose={() => !busy && noText()} footer={footer}>
      <div data-testid="im-here-sheet">
        {!read ? (
          <p style={S.muted}>{ON_MY_WAY_WORDS.marking}</p>
        ) : (
          <>
            {preview ? (
              <>
                <p style={{ ...S.label, marginTop: 0 }}>{ON_MY_WAY_WORDS.gets(first)}</p>
                <p style={S.bubble} data-testid="im-here-preview">
                  {preview.text}
                </p>
              </>
            ) : null}
            <p style={S.label}>{ON_MY_WAY_WORDS.happens}</p>
            {a.rows.map((r) => (
              <p key={r.words} style={S.actRow} data-testid="im-here-act">
                <span aria-hidden>{r.icon}</span>
                <span>{r.words}</span>
              </p>
            ))}
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
