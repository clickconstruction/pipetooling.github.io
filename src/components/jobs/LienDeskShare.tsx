import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'
import { buildLienStatusPayload, lienShareHouseJobs, lienShareScopeOptions, type LienShareScope } from '../../lib/jobs/lienDeskShare'
import type { LienSupplierJob } from '../../lib/jobs/lienJobSuppliers'
import { fetchFirmPortalUrl } from '../../lib/jobs/lienDeskShareIo'
import { runJobShare } from '../../lib/jobShare'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { lienStatusDeskPath, lienStatusSubject, lienStatusText } from '../../../supabase/functions/_shared/lienDeskStatus'
import LienDeskSharePanel from './LienDeskSharePanel'
import LienDeskEmailSheet from './LienDeskEmailSheet'

const COPIED = 'Copied. Paste it into a text, an email or a chat.'
const COPY_FAILED = 'Could not copy the message. Select it and copy it by hand.'

function namesWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'them'
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The Lien desk's Share (v2.4311): mounted while the title bar's Share is open. The numbers are
 * read once when it opens (the message says the time), the panel shows the message, and the
 * email window takes over the same scope and payload.
 */
export default function LienDeskShare({
  isMobile,
  data,
  calendarRows,
  suppliers,
  todayYmd,
  me,
  onClose,
}: {
  isMobile: boolean
  data: LienDeskData
  calendarRows?: ReadonlyArray<LienCalendarJob> | null
  /** The desk's supply-house read (v2.4407): the jobs where a house is also owed are one more thing to send. */
  suppliers?: ReadonlyMap<string, LienSupplierJob>
  todayYmd: string
  me: { id: string | null; name: string }
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  const [view, setView] = useState<'panel' | 'email'>('panel')
  const [scope, setScope] = useState<LienShareScope>('all')
  const [asOf] = useState(() => new Date().toISOString())
  const [firm, setFirm] = useState<{ firmName: string; url: string | null } | null>(null)
  useEffect(() => {
    let live = true
    fetchFirmPortalUrl(window.location.origin)
      .then((f) => {
        if (live) setFirm(f)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const houses = useMemo(() => (suppliers ? lienShareHouseJobs({ data, calendarRows, suppliers, todayYmd }) : []), [data, calendarRows, suppliers, todayYmd])
  const options = useMemo(() => lienShareScopeOptions(data, houses), [data, houses])
  // A GC that left the desk since it was picked falls back to the whole desk.
  const current: LienShareScope = options.some((o) => o.key === scope) ? scope : 'all'
  const payload = useMemo(() => buildLienStatusPayload({ data, calendarRows, todayYmd, nowIso: asOf, scope: current, houses }), [data, calendarRows, todayYmd, asOf, current, houses])
  const text = useMemo(() => lienStatusText(payload), [payload])
  const url = `${window.location.origin}${lienStatusDeskPath(payload)}`
  const asOfWords = new Date(asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = (value: string, done: string) => {
    if (!navigator.clipboard) {
      showToast(COPY_FAILED, 'error')
      return
    }
    navigator.clipboard.writeText(value).then(
      () => showToast(done, 'success'),
      () => showToast(COPY_FAILED, 'error'),
    )
  }

  if (view === 'email') {
    return (
      <LienDeskEmailSheet
        isMobile={isMobile}
        asOfWords={asOfWords}
        options={options}
        scope={current}
        onScope={setScope}
        payload={payload}
        me={me}
        onBack={() => setView('panel')}
        onClose={onClose}
        onSent={(sentTo, failed) => {
          if (failed.length) showToast(`Emailed ${namesWords(sentTo)}. It did not reach ${namesWords(failed)}. Try again from Share.`, 'error')
          else showToast(`Emailed ${namesWords(sentTo)}.`, 'success')
          onClose()
        }}
      />
    )
  }
  return (
    <LienDeskSharePanel
      isMobile={isMobile}
      asOfWords={asOfWords}
      options={options}
      scope={current}
      onScope={setScope}
      message={`${text}\n${url}`}
      canShare={canShare}
      onSend={() => {
        // The share sheet must open inside the tap (iOS), so nothing is awaited before it.
        void runJobShare({ title: lienStatusSubject(payload), text, url }, navigator).then((outcome) => {
          if (outcome === 'shared') onClose()
          else if (outcome === 'copied') showToast(COPIED, 'success')
          // 'failed' = no share sheet took it and the copy was refused too: say the one thing left to do.
          else if (outcome === 'failed') showToast(COPY_FAILED, 'error')
        })
      }}
      onCopy={() => copy(`${text}\n${url}`, COPIED)}
      onEmail={() => setView('email')}
      firm={firm}
      onCopyFirm={() => firm?.url && copy(firm.url, 'The firm’s link is copied. Send it to the firm however you like.')}
      onClose={onClose}
    />
  )
}
