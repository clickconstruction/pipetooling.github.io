import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOpenFlowStep } from '../../hooks/useFlowNow'
import { useFlowPerson, type FlowPersonAt } from '../../hooks/useFlowPerson'
import { useGcPortalLinks } from '../../hooks/useGcPortalLinks'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { stepCard, type CardPress, type PressId } from '../../lib/flows/card'
import { nextMonday } from '../../lib/flows/nudges'
import { flowPanel } from '../../lib/flows/panel'
import { stepById, stepReading } from '../../lib/flows/state'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, input } from '../gc/gcUi'
import { FlowPanel } from './FlowPanel'
import { FlowRail } from './FlowRail'
import { FlowStepCard, type AskFor } from './FlowStepCard'

/** The presses a paper takes: the window's own send, the Documents row, the file it holds. */
const PAPER_PRESSES: readonly PressId[] = ['open', 'sendIt', 'remindThem', 'askForIt', 'fileByHand', 'seeIt', 'askAgain', 'remind', 'ask', 'sendItNow']

/** The thread window's phone (`ThreadWindow.tsx`): under it the side keeps its rail and opens sheets over the window. */
const THREAD_PHONE = '(max-width: 760px)'
/** The side's width at a desk with the panel open. */
const SIDE_WIDTH = 340

/**
 * One person's flow where a window shows it (Messages cut 4): the panel and a step's card, beside the panel at a desk
 * and as a sheet on a phone. In the thread window's side (`side`, `threadSlots.tsx`) it starts as the rail beside the
 * thread: at a desk the rail opens to the panel at the side's width and a step's card covers the side; on a phone the
 * rail stays, and the panel and the card open as sheets over the window. The notes, skips, holds and reminders go
 * through the flow's presses; a paper's press goes to the window's own send (`onPaper`); nothing new sends.
 */
export function FlowTab({
  at,
  pageHref,
  onPaper,
  onActivity,
  onEditFlow,
  side = false,
}: {
  at: FlowPersonAt
  /** Their page, where the window knows it better than the flow's read (a customer's portal link). */
  pageHref?: string | null
  /** A paper's press: the window's own send or Documents row. Unset: those presses are greyed. */
  onPaper?: (press: CardPress) => void
  /** After Remind now: the window's Activity, where the call is written down. */
  onActivity?: () => void
  onEditFlow?: () => void
  /** The thread window's side: a rail that opens to the panel. */
  side?: boolean
}) {
  const { contactId, got, presses } = useFlowPerson(at)
  const narrow = useIsNarrowScreen()
  const phone = useMatchMedia(THREAD_PHONE)
  const [jobId, setJobId] = useState<string | null>(null)
  const [folded, setFolded] = useState(side)
  const [open, setOpen] = useState<{ stepId: string; jobId: string | null } | null>(null)
  const [asking, setAsking] = useState<AskFor | null>(null)
  const [takingOff, setTakingOff] = useState(false)
  const [offWhy, setOffWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // A customer's page is their portal link, which the office reads; a trade partner's comes with the flow's read.
  const ready = got.state === 'ready' ? got : null
  const customerId = at.customerId ?? ready?.read.rows.card?.customer_id ?? null
  const customerIds = useMemo(() => (customerId ? [customerId] : []), [customerId])
  const { links } = useGcPortalLinks(customerIds, customerIds.length > 0)
  const href = pageHref ?? (customerId ? (links.get(customerId)?.url ?? null) : null) ?? ready?.read.rows.previewPath ?? null
  const handles = useMemo(
    () => new Set<PressId>(['addNote', 'skip', 'putBack', 'holdUntilMon', 'remindNow', 'putBackOn', ...(href ? (['seeTheirPage'] as PressId[]) : []), ...(onPaper ? PAPER_PRESSES : [])]),
    [href, onPaper],
  )

  // Cut 3's Find a reply opens a step's card in the side (`openFlowStep`): over the side at a desk, a sheet on a phone.
  const openAsked = useCallback(
    (stepId: string, j: string | null) => {
      if (!phone) setFolded(false)
      setAsking(null)
      setProblem(null)
      setOpen({ stepId, jobId: j })
    },
    [phone],
  )
  useOpenFlowStep(side ? contactId : null, openAsked)

  // The side's panel sheet on a phone folds back to the rail on Escape, before the thread window takes it. An open
  // card takes Escape first (`FlowStepCard`).
  const sheetOpen = side && phone && !folded
  useEffect(() => {
    if (!sheetOpen || open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      setFolded(true)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [sheetOpen, open])

  if (side && got.state !== 'ready')
    return got.state === 'none' ? null : (
      <aside aria-label="Their flow" aria-busy={got.state === 'loading'} data-flow-side="" style={{ flex: 'none', width: 64, display: 'flex', justifyContent: 'center', padding: '0.75rem 0', borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}>
        {got.state === 'error' ? (
          <span role="alert" title={got.words} aria-label={`Their flow: ${got.words}`} style={{ color: 'var(--text-red-800)', fontWeight: 700 }}>
            !
          </span>
        ) : (
          <span title="Reading their flow…" style={{ color: 'var(--text-muted)' }}>
            …
          </span>
        )}
      </aside>
    )
  if (got.state === 'loading') return <p style={{ color: 'var(--text-muted)' }}>Reading their flow…</p>
  if (got.state === 'none') return <p style={{ color: 'var(--text-muted)' }}>There is no thread for them yet, so there is no flow to show.</p>
  if (got.state === 'error') return <p role="alert" style={{ color: 'var(--text-red-800)' }}>{got.words}</p>

  const person = got.person
  const model = flowPanel(person, jobId, [])
  const now = new Date()
  const card = open ? stepCard(person, open.stepId, open.jobId, now) : null

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setProblem(null)
    try {
      await fn()
      setAsking(null)
      setTakingOff(false)
      setOffWhy('')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onPress = (p: CardPress) => {
    const stepId = p.stepId ?? open?.stepId
    const job = p.jobId !== undefined ? p.jobId : (open?.jobId ?? null)
    if (!stepId) return
    switch (p.id) {
      case 'addNote':
        return setAsking({ press: p, label: 'The note, for the team', placeholder: 'What the team should know about this step.' })
      case 'skip':
        return setAsking({ press: p, label: 'Why skip it for them?', placeholder: 'A supplier: no agreement.' })
      case 'putBack':
        return void go(() => presses.putBack(stepId, job))
      case 'holdUntilMon':
        return void go(() => presses.holdUntil(stepId, job, nextMonday(now)))
      case 'remindNow': {
        const how = stepById(person.flow, stepId)?.nudge?.how ?? 'call'
        const round = stepReading(person.reading, stepId, job)?.rounds.find((r) => r.state === 'now')?.key ?? null
        return void go(async () => {
          await presses.remindNow(stepId, job, how, round)
          onActivity?.()
        })
      }
      case 'seeTheirPage':
        if (href) window.open(href, '_blank', 'noopener,noreferrer')
        return
      case 'putBackOn':
        return void go(() => presses.putBackOn())
      default:
        if (onPaper && PAPER_PRESSES.includes(p.id)) onPaper(p)
    }
  }

  const answer = (words: string) => {
    if (!asking || !open) return
    const stepId = asking.press.stepId ?? open.stepId
    const job = asking.press.jobId !== undefined ? asking.press.jobId : open.jobId
    void go(() => (asking.press.id === 'skip' ? presses.skip(stepId, job, words) : presses.addNote(stepId, job, words)))
  }

  const openStep = (stepId: string, j: string | null) => {
    setAsking(null)
    setProblem(null)
    setOpen({ stepId, jobId: j })
  }

  const panel = (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <FlowPanel
        model={model}
        onStep={(stepId, j) => {
          setAsking(null)
          setProblem(null)
          setOpen((o) => (o && o.stepId === stepId && o.jobId === j ? null : { stepId, jobId: j }))
        }}
        onJob={(j) => {
          setJobId(j)
          setOpen(null)
        }}
        {...(side ? { onFold: () => setFolded(true) } : {})}
        pageHref={href}
        {...(onEditFlow ? { onEditFlow } : {})}
        onTakeOff={() => setTakingOff(true)}
      />
      {takingOff ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.85rem' }}>Why do they come off the flow?</span>
            <textarea value={offWhy} onChange={(e) => setOffWhy(e.target.value)} rows={2} placeholder="Declined our bid, went with another plumber." style={{ ...input, width: '100%' }} />
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn kind="primary" onClick={() => void go(() => presses.setOff(offWhy.trim()))} disabled={busy || !offWhy.trim()}>
              Take off the flow
            </Btn>
            <Btn kind="plain" onClick={() => setTakingOff(false)}>
              Not now
            </Btn>
          </div>
          {problem && !card ? (
            <p role="alert" style={{ margin: 0, color: 'var(--text-red-800)' }}>
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  const stepCardAs = (sheet: boolean) =>
    card ? (
      <FlowStepCard
        card={card}
        onPress={onPress}
        handles={handles}
        onClose={() => {
          setOpen(null)
          setAsking(null)
        }}
        sheet={sheet}
        asking={asking}
        onAnswer={answer}
        onCancelAsk={() => setAsking(null)}
        busy={busy}
        problem={problem}
      />
    ) : null

  if (side) {
    const rail = (
      <FlowRail
        model={model}
        onOpen={() => setFolded(false)}
        onStep={(stepId, j) => {
          if (!phone) setFolded(false)
          openStep(stepId, j)
        }}
      />
    )
    const railOnly = folded || phone
    return (
      <aside
        aria-label="Their flow"
        data-flow-side={railOnly ? 'rail' : 'panel'}
        style={{ position: 'relative', flex: 'none', width: railOnly ? undefined : SIDE_WIDTH, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: railOnly ? '0.5rem 0.25rem' : '0.75rem' }}>{railOnly ? rail : panel}</div>
        {sheetOpen ? (
          <div role="dialog" aria-modal="true" aria-label={model.title} data-flow-sheet="" style={{ position: 'fixed', inset: 0, zIndex: 760, display: 'flex', flexDirection: 'column', background: 'var(--surface)', paddingTop: 'var(--app-top-chrome, 0px)' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem' }}>{panel}</div>
          </div>
        ) : null}
        {card && !phone ? <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '0.5rem', background: 'var(--surface)' }}>{stepCardAs(false)}</div> : null}
        {card && phone ? stepCardAs(true) : null}
      </aside>
    )
  }

  const beside = Boolean(card) && !narrow
  return (
    <div data-flow-tab="" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: beside ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start' }}>
      {panel}
      {stepCardAs(narrow)}
    </div>
  )
}
