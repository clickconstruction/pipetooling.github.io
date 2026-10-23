/**
 * Messages in the header (residential R2, PR 1): `/messages`, the office's one page for everyone who writes to us.
 * It is Follow up (cut 2's queue: Needs you, Needs a reply, We owe them) with the kind pills over it
 * (`messages/kindPills.ts`), kept in the URL as `?kind=` so the Dashboard's Customers line lands filtered. Supply
 * houses and candidates are never on Follow up, so their pill shows the people list (cut 1's) for those two kinds.
 * A row opens the person's thread as cut 1's window over the page (`?thread=<contact id>&at=<message id>`), with
 * the job and record openers of `useMessagesHost`. The *New* lane and the header's badge are R7's. The top of the page
 * (v2.5801, punch list #151 PR 2, option C of the header mock-ups) is one bar: `components/messages/MessagesTopBar` with
 * the kind picker, Show, the search glass, the jump strip (v2.5799, PR 1, the Pipeline's stage bar over the lanes) and
 * 7 days, which opens The last 7 days under the bar.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FollowUpPanel } from '../components/followUp/FollowUpPanel'
import { GcMessages } from '../components/gc/GcMessages'
import { WaitingOnThem } from '../components/messages/WaitingOnThem'
import { WeekStrip } from '../components/messages/WeekStrip'
import { WentOutToday } from '../components/messages/WentOutToday'
import { MessagesTopBar } from '../components/messages/MessagesTopBar'
import { ThreadWindow } from '../components/gc/messages/ThreadWindow'
import { useMessagesHost } from '../components/gc/messages/useMessagesHost'
import { MessagesRereadContext } from '../components/gc/messages/useMessagesReread'
import { useThreadWindow } from '../components/gc/messages/useThreadWindow'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { canOpenMessages, isOwnerOrDev } from '../lib/gc/access'
import { SwitchOnCard } from '../components/messages/SwitchOnCard'
import { pageGate } from '../lib/roleGate'
import { loadGcTeam, type GcTeamMember } from '../lib/gc/gcIo'
import { followUpTeamOf } from '../lib/followUp/team'
import { needsYouCount } from '../lib/followUp/queue'
import { JUMP_LANE_ANCHOR, QUEUE_LANES, type JumpCounts, type JumpLane } from '../lib/messages/jumpStrip'
import { keepWeekOpen, readWeekOpen } from '../lib/messages/topBar'
import { EVERYONE_WORDS } from '../lib/messages/everyone'
import { QUEUES_FOLD_WORDS } from '../lib/messages/queuesFold'
import { queryOf, searchLines, SEARCH_MIN, SEARCH_WORDS, withQuery } from '../lib/messages/searchLines'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { peopleForPill, pillOf, pillOnFollowUp, queueForPill, withPill, type KindPill } from '../lib/messages/kindPills'
import { keepLens, lensCounts, queueForShow, readLens, SHOW_WORDS, type ShowLens } from '../lib/messages/showLens'
import { waitsFromQueue } from '../lib/messages/weekStrip'
import type { WentOutFilter } from '../lib/messages/wentOut'

/** Search every message (v2.5701): the box under the pills, a hit's row, and the lane's one-line answers. */
const searchBox: CSSProperties = { padding: '0.55rem 0.8rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.95rem', maxWidth: 560, width: '100%', boxSizing: 'border-box' }
const searchAnswer: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }
const searchHit: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'baseline', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.85rem', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box', font: 'inherit' }
const searchMark: CSSProperties = { background: 'var(--bg-amber-100)', color: 'inherit', borderRadius: 3, padding: '0 2px' }

export default function Messages() {
  const { user, role, profileName, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [params, setParams] = useSearchParams()
  const pill = pillOf(params)
  const thread = useThreadWindow()
  // A hard load (a typed link, the reply push, a new tab) waits for the role before it decides (`pageGate`).
  const gate = pageGate({ loading: authLoading, user, role }, canOpenMessages)
  const canOpen = gate === 'open'
  const onFollowUp = pillOnFollowUp(pill)
  // Everyone we have talked with (v2.5700): the people list under the queues, opened on a press, since its view reads
  // every contact and message there is. The queues never wait on that read.
  const [everyoneOpen, setEveryoneOpen] = useState(false)
  // Search every message (v2.5701): the box under the pills; two letters typed read the view and draw the lines that
  // match in place of the lists, each opening the thread at its line.
  // The words live in the URL as `?q=` (v2.5708), like the pill: a reload keeps them and a link carries them.
  const q = queryOf(params)
  const setQ = useCallback((words: string) => setParams((prev) => withQuery(prev, words), { replace: true }), [setParams])
  const searching = q.trim().length >= SEARCH_MIN
  // On a phone, three empty lists fold to one line until something waits or the office opens them (v2.5708).
  const phone = useMatchMedia('(max-width: 760px)')
  const [queueCount, setQueueCount] = useState<number | null>(null)
  const [queuesOpen, setQueuesOpen] = useState(false)
  const foldQueues = phone && queueCount === 0 && !queuesOpen
  // Answer all (punch list #140 PR 6): the desk over Needs a reply; while it is open the host's view is read, since the
  // desk's reply box sends as the thread would.
  const [answering, setAnswering] = useState(false)
  const host = useMessagesHost({ enabled: canOpen && (!onFollowUp || thread.contactId !== null || everyoneOpen || searching || answering), closeThread: thread.closeThread })

  const [team, setTeam] = useState<GcTeamMember[]>([])
  useEffect(() => {
    if (!canOpen) return
    let live = true
    loadGcTeam()
      .then((t) => live && setTeam(t))
      .catch(() => live && setTeam([]))
    return () => {
      live = false
    }
  }, [canOpen])
  const followUpTeam = useMemo(() => followUpTeamOf(team), [team])
  const me = useMemo(() => ({ id: user?.id ?? '', name: profileName || 'You', role: role ?? '' }), [user?.id, profileName, role])

  const pick = (next: KindPill) => setParams((prev) => withPill(prev, next), { replace: true })
  // Show: Mine · Everyone (punch list #140 PR 3): the lens over every lane, kept per browser; its counts from the whole queue.
  const [lens, setLens] = useState<ShowLens>(readLens)
  // The one-row header (v2.5801, punch list #151 PR 2): the search box opens from the glass, or at once for a link with
  // ?q=, and closing it clears the words; The last 7 days opens from 7 days and stays as you left it on this browser.
  const [searchOpen, setSearchOpen] = useState(() => q.trim().length > 0)
  const searchRef = useRef<HTMLInputElement>(null)
  const openSearch = (open: boolean) => {
    setSearchOpen(open)
    if (!open) setQ('')
  }
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])
  const [weekOpen, setWeekOpen] = useState(readWeekOpen)
  const openWeek = (open: boolean) => {
    setWeekOpen(open)
    keepWeekOpen(open)
  }
  const [lensCount, setLensCount] = useState<{ mine: number; everyone: number } | null>(null)
  const meId = user?.id ?? ''
  const narrow = useCallback<NonNullable<Parameters<typeof FollowUpPanel>[0]['narrow']>>((queue, contacts) => queueForShow(queueForPill(queue, contacts, pill), contacts, lens, meId), [pill, lens, meId])
  // The last 7 days (punch list #140 PR 5): the strip under the search, its longest wait from the queue the panel
  // already read (the whole queue under the pill, never the lens: the strip is the office's read), its doors the
  // lanes below. Went out's filter lives here so the strip's Texts not delivered can open the texts.
  type Heard = Parameters<NonNullable<Parameters<typeof FollowUpPanel>[0]['onQueue']>>
  const [heard, setHeard] = useState<{ queue: Heard[0]; contacts: Heard[1] } | null>(null)
  const onQueue = useCallback<NonNullable<Parameters<typeof FollowUpPanel>[0]['onQueue']>>(
    (queue, contacts) => {
      setLensCount(lensCounts(queue, contacts, meId))
      setHeard({ queue, contacts })
    },
    [meId],
  )
  const waits = useMemo(() => {
    if (!heard) return []
    const names = Object.fromEntries([...followUpTeam, me].map((t) => [t.id, t.name]))
    return waitsFromQueue(queueForPill(heard.queue, heard.contacts, pill).needsReply, heard.contacts, (id) => names[id] ?? null)
  }, [heard, pill, followUpTeam, me])
  const [wentOutFilter, setWentOutFilter] = useState<WentOutFilter>('both')
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  // The jump strip (v2.5799, punch list #151 PR 1): the lanes with the counts their headings show — the queue lanes from
  // the queue the panel read, narrowed as the panel draws it; Waiting on them and Went out from their own reads. A press
  // scrolls to the lane, unfolding the queues on a phone first.
  const [waitingCount, setWaitingCount] = useState<number | null>(null)
  const [wentOutCount, setWentOutCount] = useState<number | null>(null)
  const jumpCounts = useMemo<JumpCounts>(() => {
    const q = heard ? narrow(heard.queue, heard.contacts) : null
    return {
      new: q ? q.newLane.length : null,
      needsYou: q ? needsYouCount(q) : null,
      needsReply: q ? q.needsReply.length : null,
      weOwe: q ? q.weOwe.length + q.calls.length : null,
      waiting: waitingCount,
      wentOut: wentOutCount,
    }
  }, [heard, narrow, waitingCount, wentOutCount])
  const jump = (lane: JumpLane) => {
    if (QUEUE_LANES.has(lane)) setQueuesOpen(true)
    // The queues may have been folded: let them draw before the scroll.
    requestAnimationFrame(() => scrollTo(JUMP_LANE_ANCHOR[lane]))
  }
  const listView = useMemo(() => (host.view ? { ...host.view, contacts: peopleForPill(host.view.contacts, pill) } : null), [host.view, pill])
  const found = useMemo(() => (searching && host.view ? searchLines(host.view.messages, host.view.contacts, q, pill, host.nowIso) : null), [searching, host.view, host.nowIso, q, pill])

  if (gate === 'wait') return <div data-messages-loading style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading…</div>
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  return (
    <div data-messages-page style={{ padding: '1rem', display: 'grid', gap: '1rem', maxWidth: 1100, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
      <MessagesTopBar
        pill={pill}
        onPick={pick}
        lens={lens}
        lensCount={lensCount}
        onLens={(v) => {
          setLens(v)
          keepLens(v)
        }}
        searchOpen={searchOpen}
        onSearch={openSearch}
        weekOpen={weekOpen}
        onWeek={openWeek}
        strip={!searching && onFollowUp ? { counts: jumpCounts, onJump: jump } : undefined}
        phone={phone}
      />
      {lens === 'mine' && !searching && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="show-note">
          {SHOW_WORDS.notNarrowed}
        </div>
      )}
      {searchOpen && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={SEARCH_WORDS.label} placeholder={SEARCH_WORDS.placeholder} data-testid="search-lines" style={searchBox} />
          {q.trim().length > 0 && !searching && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{SEARCH_WORDS.short}</span>}
        </div>
      )}
      {/* Punch list #140 PR 2: the owner's and a dev's line to the switches still off, gone once all eight are on. */}
      {isOwnerOrDev(role) && !searching && <SwitchOnCard />}

      {searching && (
        <section aria-label="Lines that match" data-testid="search-hits">
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{SEARCH_WORDS.title(found?.total ?? 0)}</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{SEARCH_WORDS.note}</span>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {host.problem ? (
              <div style={searchAnswer}>{host.problem}</div>
            ) : !found ? (
              <div style={searchAnswer}>{SEARCH_WORDS.reading}</div>
            ) : found.hits.length === 0 ? (
              <div style={searchAnswer} data-testid="search-none">
                {SEARCH_WORDS.none}
              </div>
            ) : (
              <>
                {found.hits.map((h) => (
                  <button key={h.id} type="button" onClick={() => thread.openThread(h.contactId, h.id)} data-testid="search-hit" style={searchHit}>
                    <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0 }}>
                      <span>
                        <span style={{ fontWeight: 600 }}>{h.name}</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {h.who}</span>
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {h.before}
                        <mark style={searchMark}>{h.match}</mark>
                        {h.after}
                      </span>
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h.when}</span>
                  </button>
                ))}
                {found.total > found.hits.length && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{SEARCH_WORDS.more(found.total - found.hits.length)}</div>}
              </>
            )}
          </div>
        </section>
      )}

      {!searching && onFollowUp && weekOpen && (
        <WeekStrip
          pill={pill}
          waits={waits}
          mine={lens === 'mine'}
          onOpenThread={(id, at) => thread.openThread(id, at)}
          onNeedsReply={() => {
            setQueuesOpen(true)
            scrollTo('queues')
          }}
          onWentOut={() => {
            setWentOutFilter('texts')
            scrollTo('went-out')
          }}
          onWaiting={() => scrollTo('waiting-on-them')}
        />
      )}


      {!searching && onFollowUp && foldQueues && (
        <button
          type="button"
          onClick={() => setQueuesOpen(true)}
          data-testid="queues-fold"
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', background: 'var(--surface)', color: 'var(--text-muted)', font: 'inherit', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          <span aria-hidden>▸</span>
          <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{QUEUES_FOLD_WORDS.line}</span>
          <span style={{ marginLeft: 'auto' }}>{QUEUES_FOLD_WORDS.tail}</span>
        </button>
      )}
      {searching ? null : onFollowUp ? (
        // The panel stays mounted under the fold, so its count keeps the fold honest.
        <div id="queues" style={foldQueues ? { display: 'none' } : undefined} data-testid="queues">
          <FollowUpPanel
            me={me}
            team={followUpTeam}
            onOpenThread={thread.openThread}
            say={showToast}
            narrow={narrow}
            onCount={setQueueCount}
            onQueue={onQueue}
            answerAll={{ on: answering, onChange: setAnswering, thread: { view: host.view, nowIso: host.nowIso, searchJobs: host.writes.searchJobs } }}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>They never count on Follow up. Each shows here by their last line.</div>
          <GcMessages view={listView} problem={host.problem} nowIso={host.nowIso} onOpenThread={(id) => thread.openThread(id)} filters={false} />
        </div>
      )}

      {/* Went out (v2.5686, punch list #133 PR 3): the queues are inbound; this is where a pressed send shows. */}
      {/* Waiting on them (v2.5704): who went quiet after our send; Needs a reply above is who waits on us. */}
      {!searching && onFollowUp && <WaitingOnThem pill={pill} onOpenThread={(id, more) => thread.openThread(id, null, more)} onCount={setWaitingCount} />}

      {!searching && <WentOutToday pill={pill} onOpenThread={thread.openThread} filter={wentOutFilter} onFilter={setWentOutFilter} onCount={setWentOutCount} />}

      {/* Everyone we have talked with (v2.5700): the people list with its search, for every pill the queues serve; the
          last pill already shows the list in the queues' place. */}
      {!searching && onFollowUp && (
        <section aria-label={EVERYONE_WORDS.title} data-testid="everyone">
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{EVERYONE_WORDS.title}</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{EVERYONE_WORDS.note}</span>
            <button
              type="button"
              onClick={() => setEveryoneOpen((open) => !open)}
              data-testid="everyone-toggle"
              style={{
                marginLeft: 'auto',
                padding: '0.3rem 0.8rem',
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text-link)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {everyoneOpen ? EVERYONE_WORDS.hide : EVERYONE_WORDS.show}
            </button>
          </div>
          {everyoneOpen && <GcMessages view={listView} problem={host.problem} nowIso={host.nowIso} onOpenThread={(id) => thread.openThread(id)} filters={false} />}
        </section>
      )}

      {thread.contactId && (
        <MessagesRereadContext.Provider value={host.reread}>
          <ThreadWindow
            contactId={thread.contactId}
            at={thread.at}
            onClose={thread.closeThread}
            view={host.view}
            problem={host.problem}
            nowIso={host.nowIso}
            writes={host.writes}
            onOpenJob={host.openJob}
            onOpenRecord={host.openRecord}
            onShowContact={(id) => thread.openThread(id)}
          />
        </MessagesRereadContext.Provider>
      )}
    </div>
  )
}
