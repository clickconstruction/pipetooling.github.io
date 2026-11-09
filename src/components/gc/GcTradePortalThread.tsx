import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import type { SentMessage } from '../../lib/gc/tradePortalPage'
import { mergedThread, threadJobs, tradeThreadRows, urgentName, type PortalThreadLine, type TradeThreadRow } from '../../lib/gc/tradePortalThread'
import type { GcProject } from '../../lib/gc/types'
import { CARD, HAIR, INK, MUTED, portalPressFill } from '../../lib/portal/portalTheme'
import { input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress } from './gcTradePortalPress'
import { PortalNote } from './GcTradePortalUi'

/**
 * Punch list #205, row 2 (PR 5): the Messages tab of a trade partner's portal, the customer's `PortalGcMessages` in the
 * portal's words. The same conversation as the company's texts and emails with us: the thread `gc-trade-portal` reads
 * from Messages merged with the emails we sent it, oldest first, each bubble theirs or ours with who, the day and how it
 * came, a long one cut with More; then the box: About, a job or none, the words, Send. The line posts as
 * `portal_message`; the page reads the slice again, which refreshes the thread, and the line stays on screen either way
 * (the sample answers ok and reads the same thread back). Under it, who to call for something urgent on site.
 */

const GC = GC_COMPANY.shortName

const bubble = (mine: boolean): CSSProperties => ({
  borderRadius: 10,
  padding: '7px 10px',
  maxWidth: '90%',
  justifySelf: mine ? 'start' : 'end',
  background: mine ? CARD : 'var(--bg-amber-100)',
  border: `1px solid ${HAIR}`,
  color: INK,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  fontSize: '0.9rem',
})

export function GcTradePortalThread({ lines: shipped, messages, projects }: { lines: readonly PortalThreadLine[]; messages: readonly SentMessage[]; projects: readonly GcProject[] }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  // What was sent from this tab and is not in the thread yet: the page's re-read carries it in, and until then it stays.
  const [sent, setSent] = useState<PortalThreadLine[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const jobs = useMemo(() => threadJobs(projects), [projects])
  const [projectId, setProjectId] = useState<string>(jobs.length === 1 ? jobs[0]!.id : '')
  useEffect(() => {
    if (jobs.length === 1) setProjectId(jobs[0]!.id)
  }, [jobs])
  const lines = useMemo(() => {
    const have = new Set(shipped.map((l) => l.id))
    const bodies = new Set(shipped.filter((l) => l.dir === 'in' && l.door === 'portal').map((l) => l.body))
    return mergedThread([...shipped, ...sent.filter((l) => !have.has(l.id) && !bodies.has(l.body))], messages)
  }, [shipped, sent, messages])
  const rows = tradeThreadRows(lang, lines)
  const urgent = urgentName(projects)

  const write = async () => {
    const body = text.trim()
    if (!body || busy || !press) return
    setBusy(true)
    setProblem(null)
    try {
      const refused = await press.send('portal_message', { projectId: projectId || null, text: body })
      if (refused) {
        setProblem(refused)
        return
      }
      setSent((all) => [...all, { id: `mine-${Date.now()}-${all.length}`, at: new Date().toISOString(), dir: 'in', door: 'portal', who: null, subject: null, body }])
      setText('')
    } finally {
      setBusy(false)
    }
  }

  const row = (r: TradeThreadRow) => {
    const whole = open.has(r.id) || r.short === r.text
    return (
      <div key={r.id} role="listitem" data-portal-line={r.mine ? 'mine' : 'theirs'} style={bubble(r.mine)}>
        {whole ? r.text : r.short}
        {!whole && (
          <>
            {' '}
            <button type="button" onClick={() => setOpen((s) => new Set([...s, r.id]))} style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
              {t('threadMore')}
            </button>
          </>
        )}
        <span style={{ display: 'block', color: MUTED, fontSize: '0.72rem', marginTop: 2 }}>{r.small}</span>
      </div>
    )
  }

  return (
    <div data-portal-thread style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('threadIntro')}</div>
      <div role="list" aria-label={t('navMessagesThread')} style={{ display: 'grid', gap: 6 }}>
        {rows.length === 0 ? <div style={{ fontSize: '0.9rem' }}>{t('threadEmpty')}</div> : rows.map(row)}
      </div>
      {press && (
        <div data-portal-thread-box style={{ display: 'grid', gap: '0.4rem' }}>
          {jobs.length > 0 && (
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', color: MUTED }}>
              {t('threadAbout')}
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={busy} style={{ ...input, flex: 1, minWidth: 0, fontSize: '0.85rem' }}>
                <option value="">{t('threadNoJob')}</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <textarea
              aria-label={t('writeToClick', { gc: GC })}
              placeholder={t('writeToClick', { gc: GC })}
              value={text}
              rows={2}
              maxLength={2000}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '0.45rem 0.55rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, font: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
            />
            <button
              type="button"
              onClick={() => void write()}
              disabled={!text.trim() || busy}
              style={{ ...portalPressFill(text.trim().length > 0), border: 'none', borderRadius: 6, padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 700, minHeight: 40, cursor: text.trim() ? 'pointer' : 'not-allowed' }}
            >
              {busy ? '…' : t('threadSend')}
            </button>
          </div>
          {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
          <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('threadHours', { gc: GC, name: urgent })}</div>
        </div>
      )}
      <PortalNote tone="paper">{t('linkYours')}</PortalNote>
    </div>
  )
}
