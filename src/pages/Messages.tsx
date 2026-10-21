/**
 * Messages in the header (residential R2, PR 1): `/messages`, the office's one page for everyone who writes to us.
 * It is Follow up (cut 2's queue: Needs you, Needs a reply, We owe them) with the kind pills over it
 * (`messages/kindPills.ts`), kept in the URL as `?kind=` so the Dashboard's Customers line lands filtered. Supply
 * houses and candidates are never on Follow up, so their pill shows the people list (cut 1's) for those two kinds.
 * A row opens the person's thread as cut 1's window over the page (`?thread=<contact id>&at=<message id>`), with
 * the job and record openers of `useMessagesHost`. The *New* lane and the header's badge are R7's.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FollowUpPanel } from '../components/followUp/FollowUpPanel'
import { GcMessages } from '../components/gc/GcMessages'
import { WentOutToday } from '../components/messages/WentOutToday'
import { ThreadWindow } from '../components/gc/messages/ThreadWindow'
import { useMessagesHost } from '../components/gc/messages/useMessagesHost'
import { MessagesRereadContext } from '../components/gc/messages/useMessagesReread'
import { useThreadWindow } from '../components/gc/messages/useThreadWindow'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { canOpenMessages } from '../lib/gc/access'
import { pageGate } from '../lib/roleGate'
import { loadGcTeam, type GcTeamMember } from '../lib/gc/gcIo'
import { followUpTeamOf } from '../lib/followUp/team'
import { EVERYONE_WORDS } from '../lib/messages/everyone'
import { KIND_PILLS, peopleForPill, pillOf, pillOnFollowUp, queueForPill, withPill, type KindPill } from '../lib/messages/kindPills'

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
  const host = useMessagesHost({ enabled: canOpen && (!onFollowUp || thread.contactId !== null || everyoneOpen), closeThread: thread.closeThread })

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
  const narrow = useCallback<NonNullable<Parameters<typeof FollowUpPanel>[0]['narrow']>>((queue, contacts) => queueForPill(queue, contacts, pill), [pill])
  const listView = useMemo(() => (host.view ? { ...host.view, contacts: peopleForPill(host.view.contacts, pill) } : null), [host.view, pill])

  if (gate === 'wait') return <div data-messages-loading style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading…</div>
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  return (
    <div data-messages-page style={{ padding: '1rem', display: 'grid', gap: '1rem', maxWidth: 1100, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Messages</h1>
        <div role="group" aria-label="Which people to show" data-messages-pills style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {KIND_PILLS.map((p) => {
            const on = pill === p.key
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                title={p.title}
                onClick={() => pick(p.key)}
                style={{
                  padding: '0.3rem 0.8rem',
                  borderRadius: 999,
                  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {onFollowUp ? (
        <FollowUpPanel me={me} team={followUpTeam} onOpenThread={thread.openThread} say={showToast} narrow={narrow} />
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>They never count on Follow up. Each shows here by their last line.</div>
          <GcMessages view={listView} problem={host.problem} nowIso={host.nowIso} onOpenThread={(id) => thread.openThread(id)} filters={false} />
        </div>
      )}

      {/* Went out (v2.5686, punch list #133 PR 3): the queues are inbound; this is where a pressed send shows. */}
      <WentOutToday pill={pill} onOpenThread={thread.openThread} />

      {/* Everyone we have talked with (v2.5700): the people list with its search, for every pill the queues serve; the
          last pill already shows the list in the queues' place. */}
      {onFollowUp && (
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
