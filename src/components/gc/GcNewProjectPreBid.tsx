import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import {
  missedMandatoryPreBid,
  partnerById,
  planLabel,
  preBidHeld,
  preBidInviteEmail,
  preBidInvited,
  preBidMinutesLine,
  preBidWords,
  questionState,
  questionsCloseOn,
  questionsOpen,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the pre-bid meeting (the owner, 2026-10-04: "Let's build the pre bid
 * meeting into the prototype"). Four parts on one page. 1: when and where, who runs it, and
 * whether a company has to come to quote. 2: who is invited, every company still quoting, and the
 * email each gets. 3: at the meeting, who came and the questions raised, which go the way of any
 * question (Questions about the plans). 4: the minutes, which ride in the next set of plans.
 */

interface Props {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onClose: () => void
}

function plusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/** A first day to suggest: a weekday, moved back from a weekend, never before today. */
function weekdayOnOrBefore(iso: string, today: string): string {
  let day = iso
  for (let i = 0; i < 2; i++) {
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay()
    if (dow === 6 || dow === 0) day = plusDays(day, -1)
  }
  return day < today ? today : day
}

function Part({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span
          style={{ display: 'inline-flex', width: '1.4rem', height: '1.4rem', borderRadius: '50%', background: 'var(--bg-muted)', color: 'var(--text-600)', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}
        >
          {n}
        </span>
        <strong style={{ fontSize: '1rem' }}>{title}</strong>
        {hint && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export function GcNewProjectPreBid({ state, project, dispatch, onClose }: Props) {
  const m = project.preBid ?? null
  const closeOn = questionsCloseOn(project)
  const [on, setOn] = useState(m?.on ?? weekdayOnOrBefore(closeOn ? plusDays(closeOn, -2) : plusDays(state.today, 3), state.today))
  const [at, setAt] = useState(m?.at ?? '10:00')
  const [place, setPlace] = useState(m?.place ?? `the site, ${project.address}`)
  const [host, setHost] = useState<'architect' | 'us'>(m?.host ?? 'architect')
  const [mandatory, setMandatory] = useState(m?.mandatory ?? false)
  const invited = preBidInvited(state, project)
  const [came, setCame] = useState<string[]>(m?.attended ?? [])
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = invited.find((r) => r.partner.id === previewId) ?? invited[0] ?? null
  const email = preview ? preBidInviteEmail(project, preview.partner) : null
  const raised = project.questions.filter((q) => q.atPreBid)
  const minutes = preBidMinutesLine(state, project)
  const late = closeOn !== null && on >= closeOn
  const changed = !m || m.on !== on || m.at !== at.trim() || m.place !== place.trim() || m.host !== host || m.mandatory !== mandatory
  const cameChanged = !m || JSON.stringify([...(m.attended ?? [])].sort()) !== JSON.stringify([...came].sort())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open picker takes Escape for itself; only an Escape nothing else used closes the window.
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="listbox"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const pill = (active: boolean) =>
    ({
      padding: '0.3rem 0.7rem',
      borderRadius: 999,
      border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
      color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
      cursor: 'pointer',
      fontSize: '0.85rem',
    }) as const

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: the pre-bid meeting`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(860px, 100%)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · the pre-bid meeting</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {preBidWords(project) ?? 'A meeting or a walk of the site with every company quoting, before our bid is due.'}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.2rem', fontSize: '0.875rem' }}>
          <Part n={1} title="When and where" hint="Questions raised there are answered for every company quoting.">
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                <span style={{ fontWeight: 600 }}>Day</span>
                <input type="date" style={input} value={on} onChange={(e) => setOn(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                <span style={{ fontWeight: 600 }}>Time</span>
                <input type="time" style={input} value={at} onChange={(e) => setAt(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: '0.2rem', flex: '1 1 16rem', minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>Where</span>
                <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} value={place} onChange={(e) => setPlace(e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" aria-pressed={host === 'architect'} onClick={() => setHost('architect')} style={pill(host === 'architect')}>
                {project.architect || 'The architect'} runs it
              </button>
              <button type="button" aria-pressed={host === 'us'} onClick={() => setHost('us')} style={pill(host === 'us')}>
                Our own walk with the trades
              </button>
              <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginLeft: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
                Coming is required to quote
              </label>
            </div>
            {late && closeOn && (
              <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>
                Questions close {weekdayDate(closeOn)}. Hold it before then, so what is raised there can still be answered.
              </span>
            )}
            <div>
              <Btn
                kind="primary"
                disabled={!changed || place.trim() === '' || at.trim() === '' || on === ''}
                onClick={() => dispatch({ type: 'schedulePreBid', projectId: project.id, on, at: at.trim(), place: place.trim(), host, mandatory })}
              >
                {m ? 'Move the meeting' : 'Set the meeting'}
              </Btn>
            </div>
          </Part>

          {m && (
            <Part n={2} title="Who is invited" hint="Every company still quoting a trade. Nothing is really sent from the prototype.">
              {invited.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>No company is asked to quote yet. Ask companies on Trades and they are invited.</span>
              ) : (
                <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', alignItems: 'start' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {invited.map((r) => (
                      <button
                        key={r.partner.id}
                        type="button"
                        onClick={() => setPreviewId(r.partner.id)}
                        aria-pressed={preview?.partner.id === r.partner.id}
                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '0.35rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: preview?.partner.id === r.partner.id ? 'var(--bg-blue-tint)' : 'transparent', color: 'var(--text-base)', cursor: 'pointer' }}
                      >
                        <strong style={{ fontWeight: 600 }}>{r.partner.company}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.trades.join(', ')}</span>
                      </button>
                    ))}
                  </div>
                  {email && (
                    <div data-theme="light" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>To {preview?.partner.company}</span>
                      <strong>{email.subject}</strong>
                      {email.body.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Part>
          )}

          {m && (
            <Part n={3} title="At the meeting" hint="Tick who came. Write down each question raised, as it was asked.">
              {invited.length > 0 && (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  {invited.map((r) => {
                    const missed = missedMandatoryPreBid(state, project, r.partner.id)
                    return (
                      <label key={r.partner.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}>
                        <input
                          type="checkbox"
                          checked={came.includes(r.partner.id)}
                          onChange={(e) => setCame((all) => (e.target.checked ? [...all, r.partner.id] : all.filter((x) => x !== r.partner.id)))}
                        />
                        <span>{r.partner.company}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.trades.join(', ')}</span>
                        {missed && <Chip tone="red">missed it, and coming was required</Chip>}
                      </label>
                    )
                  })}
                  <div>
                    <Btn disabled={!cameChanged} onClick={() => dispatch({ type: 'recordPreBidAttendance', projectId: project.id, partnerIds: came })}>
                      {preBidHeld(project) ? 'Save who came' : 'The meeting was held: save who came'}
                    </Btn>
                  </div>
                </div>
              )}
              <RaiseForm state={state} project={project} dispatch={dispatch} />
              {raised.length > 0 && (
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  <strong>Raised at the meeting</strong>
                  {raised.map((q) => (
                    <div key={q.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Chip tone={questionState(q) === 'answered' ? 'green' : questionState(q) === 'with the architect' ? 'blue' : 'amber'}>{questionState(q)}</Chip>
                      <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                        {partnerById(state, q.partnerId)?.company ?? 'A company'}: {q.text}
                      </span>
                    </div>
                  ))}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Send each one to the architect and record the answer in Questions about the plans, the way any question goes.
                  </span>
                </div>
              )}
            </Part>
          )}

          {m && (
            <Part n={4} title="The minutes" hint="Who came, and the answers, ride in the next set of plans.">
              {m.minutesInSetRev !== undefined ? (
                <span>The minutes went out in {planLabel(project, m.minutesInSetRev)}.</span>
              ) : minutes ? (
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)' }}>{minutes}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>A new set of plans came in offers them, ticked, beside the answers it carries.</span>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Once you save who came, the minutes are ready for the next set.</span>
              )}
              {!questionsOpen(project, state.today) && closeOn && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Questions closed {weekdayDate(closeOn)}.</span>
              )}
            </Part>
          )}
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  )
}

/** A question raised at the meeting: the trade, the company that asked, its sheets and its words. */
function RaiseForm({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const trades = project.packages.filter((p) => !p.selfPerform && p.invites.some((i) => i.status !== 'declined'))
  const [packageId, setPackageId] = useState(trades[0]?.id ?? '')
  const pkg = trades.find((p) => p.id === packageId)
  const companies = (pkg?.invites ?? []).filter((i) => i.status !== 'declined').map((i) => partnerById(state, i.partnerId)).filter((p): p is NonNullable<typeof p> => !!p)
  const [partnerId, setPartnerId] = useState('')
  const [sheets, setSheets] = useState('')
  const [text, setText] = useState('')
  const who = companies.some((c) => c.id === partnerId) ? partnerId : (companies[0]?.id ?? '')
  if (trades.length === 0) return null
  if (!questionsOpen(project, state.today)) return null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}>
      <strong>A question raised at the meeting</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
          <Picker value={packageId} onChange={setPackageId} placeholder="The trade" ariaLabel="The trade it is about" searchPlaceholder="Search the trades" options={trades.map((p) => ({ value: p.id, label: p.trade }))} />
        </div>
        <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
          <Picker value={who} onChange={setPartnerId} placeholder="The company" ariaLabel="The company that asked" searchPlaceholder="Search the companies" options={companies.map((c) => ({ value: c.id, label: c.company }))} />
        </div>
        <input style={{ ...input, flex: '1 1 10rem', height: FIELD_HEIGHT_PX, boxSizing: 'border-box' }} value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder="Sheets, like E-301" aria-label="The sheets it is about" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Their question, in their words"
        aria-label="The question raised at the meeting"
        style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
      />
      <div>
        <Btn
          kind="primary"
          disabled={text.trim() === '' || who === '' || !pkg}
          onClick={() => {
            if (!pkg) return
            dispatch({
              type: 'tradeAskQuestion',
              projectId: project.id,
              packageId: pkg.id,
              partnerId: who,
              text,
              sheets: sheets.split(',').map((x) => x.trim()).filter(Boolean),
              atPreBid: true,
            })
            setText('')
            setSheets('')
          }}
        >
          Add the question
        </Btn>
      </div>
    </div>
  )
}
