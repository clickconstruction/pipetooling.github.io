import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { bidIsStale, bidsIn, compareBids, leveledTotal, lowLeveled, uncostedLines, uncostedWords } from '../../lib/gc/bids'
import { exclusionRows, unitPriceWords } from '../../lib/gc/exclusions'
import { partnerById, planLabel } from '../../lib/gc/lookups'
import { travelFor, travelWords } from '../../lib/gc/map'
import { alternateWords, bidGoodUntil, bidRanOut } from '../../lib/gc/portal'
import type { GcState, Includes, Invite, TradePackage } from '../../lib/gc/types'
import { awardGate } from '../../lib/gc/vetting'
import { money, shortDate } from '../../lib/gc/words'
import { PartnerName } from './GcPartnerName'
import { Btn, Chip, PlusUnknown, input, num, td, th, type Tone } from './gcUi'

/**
 * GC mode, the real build (the Board's B5-b): Compare quotes on one trade, from the design spike's
 * `LevelPanel` (`GcOfficeTabs.tsx`) and `GcExclusionRows.tsx`. Each quote side by side, scope line by
 * scope line. A line a quote leaves out takes a cost to cover it, an exclusion takes one too, and a
 * taken alternate counts, so *All in* compares like with like (`leveledTotal`). **Carry this number**
 * makes a quote the trade's number in our price; **Carry our budget** carries ours instead. The
 * office's numbers sit on the ask (B1), never on the quote. Once the job is won, **Award and draft the
 * statement of work** takes Carry's place (B6-a-ii, from the spike's `LevelPanel` and `AwardButton`): `gc_award`
 * re-checks the gate, and a company the gate stops shows `canAward`'s words. Nudges and a quote typed in from an
 * email come in later steps.
 */

/** What Compare quotes writes: the office's numbers on an ask, and what the trade carries. */
export interface CompareWrites {
  setPlugs: (inviteId: string, plugs: Record<string, number>) => Promise<void>
  setCovers: (inviteId: string, covers: Record<string, number>) => Promise<void>
  setTakenAlternates: (inviteId: string, labels: string[]) => Promise<void>
  carry: (packageId: string, carry: { inviteId: string } | 'budget' | null) => Promise<void>
  /** Award the trade to an ask's quote, with who decided (B6-a-ii). Unset: the reader cannot award, and no Award shows. */
  award?: (inviteId: string, estimatorId: string | null) => Promise<void>
}

/** Who may be named as deciding an award: our team, and the one pressing first. */
export interface AwardTeam {
  team: { id: string; name: string }[]
  me: string | null
}

/** Award with the estimator who decided (the spike's `AwardButton`, question 7). */
function AwardButton({ team, children, disabled, title, onAward }: { team: AwardTeam; children: ReactNode; disabled?: boolean; title?: string; onAward: (by: string | null) => void }) {
  const [by, setBy] = useState(team.me && team.team.some((m) => m.id === team.me) ? team.me : (team.team[0]?.id ?? ''))
  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Estimator{' '}
        <select style={input} value={by} disabled={disabled} onChange={(e) => setBy(e.target.value)}>
          {team.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <Btn kind="primary" disabled={disabled} title={title} onClick={() => onAward(by || null)}>
        {children}
      </Btn>
    </span>
  )
}

/** Why Award is off: the company is not vetted, was declined, or is past its limit (question 3). */
function AwardBlocked({ why }: { why: string | null }) {
  return why ? <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-amber-800)', maxWidth: '22rem' }}>{why}</div> : null
}

const INCLUDES_WORDS: Record<Includes, { tone: Tone; word: string }> = {
  yes: { tone: 'green', word: 'included' },
  no: { tone: 'red', word: 'left out' },
  unclear: { tone: 'amber', word: 'not clear' },
}

const band = { ...td, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)' } as const
const small = { display: 'block', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' } as const

/** A dollar box that saves when it loses focus or on Enter, never on each key. */
function CostBox({ value, label, onSave }: { value: number; label: string; onSave: (amount: number) => Promise<void> }) {
  const [text, setText] = useState(value ? String(value) : '')
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => setText(value ? String(value) : ''), [value])
  const save = () => {
    const amount = text.trim() === '' ? 0 : Number(text)
    if (!Number.isFinite(amount) || amount < 0 || amount === value) return
    setProblem(null)
    onSave(Math.round(amount)).catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save()
  }
  return (
    <label style={small}>
      cost to cover it ${' '}
      <input type="number" min={0} step={250} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={keys} style={{ ...input, width: '6rem' }} aria-label={label} />
      {problem && <span style={{ display: 'block', color: 'var(--text-red-700)' }}>{problem}</span>}
    </label>
  )
}

export function GcCompareQuotes({
  state,
  projectId,
  packageId,
  writes,
  team = { team: [], me: null },
  onClose,
}: {
  state: GcState
  projectId: string
  packageId: string
  writes: CompareWrites
  /** For Award's Estimator. Unset: nobody to name, so the award names the one pressing. */
  team?: AwardTeam
  onClose: () => void
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  if (!project || !pkg) return null

  const bidders = bidsIn(pkg)
  const low = lowLeveled(pkg)
  const comparison = compareBids(state, project, pkg)
  const excludes = (pkg.excludes ?? []).filter((x) => x.label.trim() !== '')
  // Carry while we bid. Once the job is ours, the trade is awarded instead (B6).
  const canCarry = project.stage === 'pursuing' && !project.lostOn
  // Award once the job is won (B6-a-ii): for a reader who can award, or to show what was awarded.
  const canAward = project.stage !== 'pursuing' && !project.lostOn && Boolean(writes.award)
  const award = writes.award
  const act = (run: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    run()
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Compare ${pkg.trade} quotes`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1100px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Compare {pkg.trade} quotes</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {project.name} · our budget {money(pkg.budget)}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem', minHeight: 0 }}>
          {excludes.length > 0 && (
            <div style={{ fontSize: '0.875rem' }}>
              <strong>Known exclusions:</strong> {excludes.map((x) => `${x.label} (${x.by})`).join(', ')}.
            </div>
          )}
          {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{problem}</div>}
          {bidders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No quotes yet. Ask companies for a quote, and their numbers show here side by side.</div>
          ) : (
            <>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.35rem' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>What these quotes really cost</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>A quote that leaves work out is not the low quote. Put a cost on the missing work and compare the totals.</div>
                {comparison.lines.map((line) => (
                  <div key={line.inviteId} style={{ fontSize: '0.9rem' }}>
                    {line.text}
                  </div>
                ))}
                <div style={{ fontWeight: 700, color: comparison.complete ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>{comparison.conclusion}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} data-gc-compare={pkg.id}>
                  <thead>
                    <tr>
                      <th style={th}>Side by side</th>
                      {bidders.map((inv) => {
                        const p = partnerById(state, inv.partnerId)
                        return (
                          <th key={inv.id} style={{ ...th, textTransform: 'none', fontSize: '0.85rem', color: 'var(--text-strong)' }}>
                            {p ? <PartnerName partnerId={p.id} company={p.company} /> : null}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={td}>Their quote, as sent</td>
                      {bidders.map((inv) => (
                        <td key={inv.id} style={num}>
                          {money(inv.bid?.amount ?? 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td colSpan={bidders.length + 1} style={band}>
                        Is it in their price?
                      </td>
                    </tr>
                    {pkg.scope.map((item) => (
                      <tr key={item.id}>
                        <td style={td}>{item.label}</td>
                        {bidders.map((inv) => {
                          const answer = inv.bid?.includes[item.id] ?? 'unclear'
                          const words = INCLUDES_WORDS[answer]
                          return (
                            <td key={inv.id} style={td}>
                              {answer === 'yes' ? <span style={{ color: 'var(--text-green-700)' }}>✓ in their price</span> : <Chip tone={words.tone}>{words.word}</Chip>}
                              {answer !== 'yes' && (
                                <CostBox
                                  value={inv.bid?.plugs[item.id] ?? 0}
                                  label={`Cost to cover ${item.label} in ${partnerById(state, inv.partnerId)?.company ?? 'this quote'}`}
                                  onSave={(amount) => writes.setPlugs(inv.id, withAmount(inv.bid?.plugs ?? {}, item.id, amount))}
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <ExclusionRows pkg={pkg} bidders={bidders} writes={writes} state={state} />
                    <tr>
                      <td style={{ ...td, fontWeight: 700 }}>
                        All in
                        <div style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)' }}>their quote plus the missing work and what it excludes</div>
                      </td>
                      {bidders.map((inv) => {
                        const total = leveledTotal(pkg, inv) ?? 0
                        const line = comparison.lines.find((l) => l.inviteId === inv.id)
                        return (
                          <td key={inv.id} style={{ ...num, fontWeight: 700 }} data-gc-all-in={inv.id}>
                            {money(total)}
                            <PlusUnknown words={uncostedWords(uncostedLines(pkg, inv))} />{' '}
                            {line && !line.complete ? <Chip tone="amber">needs a cost</Chip> : comparison.complete && low?.invite.id === inv.id && <Chip tone="green">lowest</Chip>}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td style={td}>Against our budget of {money(pkg.budget)}</td>
                      {bidders.map((inv) => {
                        const diff = (leveledTotal(pkg, inv) ?? 0) - pkg.budget
                        // A missing cost can only raise the total: over stays true as "at least", under is not known.
                        const unknown = uncostedLines(pkg, inv).length > 0
                        if (unknown && diff <= 0) {
                          return (
                            <td key={inv.id} style={{ ...num, color: 'var(--text-muted)' }} title={uncostedWords(uncostedLines(pkg, inv))}>
                              not known yet
                            </td>
                          )
                        }
                        return (
                          <td key={inv.id} style={{ ...num, color: diff > 0 ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
                            {diff > 0 ? `${unknown ? 'at least ' : ''}${money(diff)} over` : `${money(-diff)} under`}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td style={td}>The drive to {project.town || 'the job'}</td>
                      {bidders.map((inv) => {
                        const partner = partnerById(state, inv.partnerId)
                        if (!partner) return <td key={inv.id} style={td} />
                        const travel = travelFor(state, partner, project)
                        if (travel.miles === null) {
                          return (
                            <td key={inv.id} style={{ ...td, color: 'var(--text-muted)' }}>
                              address not set
                            </td>
                          )
                        }
                        return (
                          <td key={inv.id} style={td}>
                            <Chip tone={travel.inZone ? 'grey' : 'red'}>{travel.inZone ? `${travel.miles} mi from ${partner.base}` : travelWords(travel, partner)}</Chip>
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td style={td}>Plans they priced</td>
                      {bidders.map((inv) => {
                        const stale = bidIsStale(project, pkg, inv)
                        return (
                          <td key={inv.id} style={td}>
                            <Chip tone={stale ? 'amber' : 'green'}>{planLabel(project, inv.bid?.basedOnRev ?? null)}</Chip>
                            {stale && <span style={{ ...small, color: 'var(--text-amber-800)' }}>Newer plans changed this trade. Ask them to confirm their number.</span>}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td style={td}>Their note</td>
                      {bidders.map((inv) => (
                        <td key={inv.id} style={{ ...td, maxWidth: '16rem', color: 'var(--text-600)' }}>
                          {inv.bid?.note || 'None.'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={td}>Their number holds</td>
                      {bidders.map((inv) => {
                        const until = inv.bid ? bidGoodUntil(inv.bid) : null
                        const ran = inv.bid ? bidRanOut(inv.bid, state.today) : false
                        return (
                          <td key={inv.id} style={td}>
                            {until === null ? (
                              <span style={{ color: 'var(--text-muted)' }}>they did not say</span>
                            ) : ran ? (
                              <Chip tone="red" title="Ask them whether it still holds.">
                                ran out {shortDate(until)}
                              </Chip>
                            ) : (
                              <span>until {shortDate(until)}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td style={td}>Alternates</td>
                      {bidders.map((inv) => (
                        <td key={inv.id} style={{ ...td, maxWidth: '16rem' }}>
                          {(inv.bid?.alternates ?? []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>None.</span>
                          ) : (
                            <span style={{ display: 'grid', gap: '0.15rem' }}>
                              {(inv.bid?.alternates ?? []).map((alt) => {
                                // An alternate moves our number only when taken (question 14).
                                const taken = (inv.bid?.takenAlternates ?? []).includes(alt.label)
                                const list = inv.bid?.takenAlternates ?? []
                                return (
                                  <span key={alt.label} style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: taken ? 600 : 400 }}>{alternateWords(alt)}</span>
                                    {taken && <Chip tone="green">taken</Chip>}
                                    {!pkg.sow && (
                                      <Btn
                                        kind="quiet"
                                        disabled={busy}
                                        title={taken ? 'Put it back. Their all-in number goes back to without it.' : 'Take it. Their all-in number, and what we carry, move by it.'}
                                        onClick={() => act(() => writes.setTakenAlternates(inv.id, taken ? list.filter((l) => l !== alt.label) : [...list, alt.label]))}
                                      >
                                        {taken ? 'Put it back' : 'Take it'}
                                      </Btn>
                                    )}
                                  </span>
                                )
                              })}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                    {canCarry && (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        {bidders.map((inv) => {
                          const carried = pkg.carried === inv.id
                          return (
                            <td key={inv.id} style={{ ...td, borderBottom: 'none' }}>
                              <Btn kind={carried ? 'plain' : 'primary'} disabled={busy} onClick={() => act(() => writes.carry(pkg.id, carried ? null : { inviteId: inv.id }))}>
                                {carried ? 'Carrying. Stop' : 'Carry this number'}
                              </Btn>
                            </td>
                          )
                        })}
                      </tr>
                    )}
                    {(canAward || pkg.awardedInviteId !== null) && (
                      <tr>
                        <td style={{ ...td, borderBottom: 'none' }} />
                        {bidders.map((inv) => {
                          // A company not vetted, or past its limit, waits for approval (question 3).
                          const gate = awardGate(state, pkg, inv)
                          return (
                            <td key={inv.id} data-gc-award={inv.id} style={{ ...td, borderBottom: 'none' }}>
                              {pkg.awardedInviteId === inv.id ? (
                                <Chip tone="green">Awarded</Chip>
                              ) : canAward && award ? (
                                <>
                                  <AwardButton team={team} disabled={busy || pkg.awardedInviteId !== null || !gate.ok} title={gate.why ?? undefined} onAward={(by) => act(() => award(inv.id, by))}>
                                    Award and draft the statement of work
                                  </AwardButton>
                                  {!gate.ok && pkg.awardedInviteId === null && <AwardBlocked why={gate.why} />}
                                </>
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {canCarry && (
            <div>
              <Btn disabled={busy} onClick={() => act(() => writes.carry(pkg.id, pkg.carried === 'plug' ? null : 'budget'))}>
                {pkg.carried === 'plug' ? 'Stop carrying our budget' : `Carry our budget of ${money(pkg.budget)} instead`}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** A map with one amount set, or taken out at 0, so the ask keeps only the costs the office typed. */
function withAmount(map: Record<string, number>, key: string, amount: number): Record<string, number> {
  const next = { ...map }
  if (amount > 0) next[key] = amount
  else delete next[key]
  return next
}

/**
 * Their exclusions, from the spike's `GcExclusionRows.tsx`: one row per exclusion any company named,
 * each company's answer, and a cost to cover one they leave out. Recording an answer from an emailed
 * quote, and asking them, come with the office's own quotes and P3's emails.
 */
function ExclusionRows({ state, pkg, bidders, writes }: { state: GcState; pkg: TradePackage; bidders: Invite[]; writes: CompareWrites }) {
  const rows = exclusionRows(pkg)
  return (
    <>
      <tr>
        <td colSpan={bidders.length + 1} style={band}>
          Their exclusions · what each company wrote its quote leaves out
        </td>
      </tr>
      {rows.length === 0 && (
        <tr>
          <td colSpan={bidders.length + 1} style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No company has listed an exclusion yet. Their quote form asks.
          </td>
        </tr>
      )}
      {rows.map((row) => (
        <tr key={row.name}>
          <td style={td}>
            {row.name}
            {row.known && <span style={small}>a Known exclusion · {row.known.by} does it</span>}
          </td>
          {row.cells.map((cell) => (
            <td key={cell.invite.id} style={td}>
              {cell.state === 'expected' && <Chip tone="violet">expected</Chip>}
              {cell.state === 'included' && <span style={{ color: 'var(--text-green-700)' }}>✓ included</span>}
              {cell.state === 'unsaid' && (
                <Chip tone="amber" title="Their quote does not say. Ask them.">
                  not said
                </Chip>
              )}
              {cell.state === 'excluded' && (
                <>
                  <Chip tone="red">excluded</Chip>
                  {cell.exclusion?.said && <span style={small}>"{cell.exclusion.said}"</span>}
                  {cell.exclusion?.unitPrice ? (
                    <span style={small}>{unitPriceWords(cell.exclusion.unitPrice)} if it comes up</span>
                  ) : (
                    <CostBox
                      value={cell.cover ?? 0}
                      label={`Cost to cover ${row.name} in ${partnerById(state, cell.invite.partnerId)?.company ?? 'this quote'}`}
                      onSave={(amount) => writes.setCovers(cell.invite.id, withAmount(cell.invite.bid?.exclusionCovers ?? {}, row.name, amount))}
                    />
                  )}
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
