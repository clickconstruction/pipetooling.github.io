import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useRobotAgents } from '../../hooks/useRobotAgents'
import { bidRefHref } from '../../lib/bids/twinQuestionBidRefs'
import type { RobotAgentView } from '../../lib/bids/robotAgents'
import { toDatetimeLocal } from '../../utils/datetimeLocal'
import { BTN, CARD, CARD_TITLE, CHIP, MUTED, STEP_REF, TWIN_VIOLET } from './twinConsoleStyles'

/**
 * The Console's Rounds card (Robot rounds PR 3, v2.5733, punch list #142, decision 8): one row
 * per key that checked in within seven days, a key being a seat on a Mac. Each row answers four
 * questions in order: is it alive (the light and the word, never colour alone), when did it last
 * check in, what is it on now, what did it finish recently. Stop the rounds and Start again are
 * the one press, read by the round in the reply to its next heartbeat, so the word on the row is
 * the robot's, not the button's.
 */
const TONE: Record<RobotAgentView['tone'], { dot: string; bg: string; fg: string }> = {
  green: { dot: '#16a34a', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  amber: { dot: '#f59e0b', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  blue: { dot: '#2563eb', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' },
  gray: { dot: 'var(--border-strong)', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

const STOP_HINT = 'Finishes the bid in hand, then claims no more. Start again brings the next round within five minutes.'

function whenTitle(iso: string | null): string | undefined {
  return iso ? toDatetimeLocal(iso).replace('T', ' ') : undefined
}

export function TwinRoundsCard({ canStop = true, onCopyRoundsKickoff }: { canStop?: boolean; /** v2.5735: the empty state's second door — copies one round for a Code session by hand (v2.5752: the rounds themselves come from Set up on this Mac). */ onCopyRoundsKickoff?: () => void }) {
  const { showToast } = useToastContext()
  const { agents, stopRounds } = useRobotAgents({ enabled: true, canStop })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recentOpen, setRecentOpen] = useState<Record<string, boolean>>({})
  if (agents === null) return null

  async function press(a: RobotAgentView) {
    const stop = !a.stoppedAt
    setBusyId(a.credentialId)
    const err = await stopRounds(a.credentialId, stop)
    setBusyId(null)
    if (err) showToast(`Could not ${stop ? 'stop' : 'start'} the rounds: ${err}`, 'error')
    else showToast(stop ? 'Stopping the rounds. The robot finishes the bid in hand, then claims no more.' : 'The rounds start again. The next round comes within five minutes.', 'success')
  }

  return (
    <div style={CARD} data-testid="twin-rounds-card">
      <h4 style={CARD_TITLE}>
        <span style={STEP_REF}>▶</span>Rounds
      </h4>
      <p style={{ ...MUTED, margin: '0 0 0.6rem', maxWidth: '72ch' }}>
        A round is one pass over the three queues from one Mac. Bids to shadow, prices to read, submittals to file, oldest first. Every five minutes, all day. A press here reaches the Mac on its next signal, within five minutes.
      </p>
      {agents.length === 0 ? (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-subtle)', fontSize: '0.84rem', display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="twin-rounds-empty">
          <span style={{ flex: '1 1 18rem' }}>No robot has checked in yet. On the Run the robots card below, press Set up on this Mac with This Mac makes the rounds ticked, and paste the command into Terminal on the Mac that stays on. Copy the round makes one round by hand in a Code session.</span>
          {onCopyRoundsKickoff ? <button type="button" style={{ ...BTN, background: '#2563eb', color: '#fff', border: 'none' }} onClick={onCopyRoundsKickoff}>Copy the round</button> : null}
        </div>
      ) : (
        agents.map((a, i) => {
          const tone = TONE[a.tone]
          const open = recentOpen[a.credentialId] ?? i === 0
          const nowHref = a.nowBidId ? bidRefHref(a.nowBidId) : null
          return (
            <div key={a.credentialId} data-testid="twin-rounds-row" style={{ display: 'grid', gridTemplateColumns: '2.2rem minmax(0, 1fr) auto', gap: '0.7rem', alignItems: 'start', padding: '0.6rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', marginBottom: '0.5rem' }}>
              <span aria-hidden style={{ width: '2.2rem', height: '2.2rem', borderRadius: 8, background: 'var(--bg-violet-100)', display: 'grid', placeItems: 'center', fontSize: '1.1rem' }}>🖥</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                  {a.robot} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{a.seat}</span>
                  <span style={{ ...CHIP, borderRadius: 999, background: 'var(--bg-violet-100)', color: TWIN_VIOLET }}>{a.kind}</span>
                  {a.nowBidNumber ? <span style={{ ...CHIP, borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>on b{a.nowBidNumber}</span> : null}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span data-testid="twin-rounds-word" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: '1px 8px 1px 6px' }}>
                    <i aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: tone.dot, display: 'inline-block', boxShadow: a.tone === 'green' ? '0 0 0 3px rgba(22,163,74,.18)' : undefined }} />
                    {a.word}
                  </span>
                  <span title={whenTitle(a.checkedInAt)} data-testid="twin-rounds-checkin">{a.checkedIn}</span>
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-700)' }}>
                  <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>Now</b>{' '}
                  {nowHref ? <a href={nowHref} style={{ color: 'inherit' }}>{a.now}</a> : a.now}
                </p>
                {a.recent.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRecentOpen((m) => ({ ...m, [a.credentialId]: !open }))}
                      aria-expanded={open}
                      style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-strong)', background: 'none', border: 'none', padding: 0, marginTop: '0.4rem', cursor: 'pointer', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                    >
                      Recently <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{open ? 'the last five it finished, newest first' : `▸ ${a.recent[0]!.words}`}</span>
                    </button>
                    {open ? (
                      <ul style={{ margin: '0.25rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.15rem' }} data-testid="twin-rounds-recent">
                        {a.recent.map((r, j) => {
                          const href = r.door.bidId ? (r.door.kind === 'bid' ? bidRefHref(r.door.bidId) : r.door.kind === 'matrix' ? `/bids?tab=pricing&bidId=${r.door.bidId}` : `/bids?tab=submittals&bidId=${r.door.bidId}`) : null
                          return (
                            <li key={j} style={{ display: 'grid', gridTemplateColumns: '6.4rem minmax(0, 1fr)', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
                              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} title={whenTitle(r.at)}>{toDatetimeLocal(r.at).slice(5, 16).replace('T', ' ')}</span>
                              {href ? <a href={href} style={{ color: 'var(--text-base)' }}>{r.words}</a> : <span>{r.words}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </>
                ) : null}
                {a.today ? (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>Today</b> {a.today}
                  </p>
                ) : null}
                {a.queue ? (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="twin-rounds-queue" title="From the robot's own check-in: the one rule the Queue's Ready and Held counts read">
                    <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>Queue</b> {a.queue}
                  </p>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {canStop ? (
                  <button type="button" style={BTN} disabled={busyId === a.credentialId} onClick={() => void press(a)} title={STOP_HINT}>
                    {a.stoppedAt ? 'Start again' : 'Stop the rounds'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })
      )}
      <p style={{ ...MUTED, margin: '0.3rem 0 0' }}>
        Alive is a check-in within seven minutes. Quiet is seven to fifteen. Asleep is over fifteen, three rounds missed. Stop the rounds reaches the rounds only, never a session a person starts by hand.
      </p>
    </div>
  )
}
