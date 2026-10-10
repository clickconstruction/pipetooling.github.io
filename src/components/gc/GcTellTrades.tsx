/**
 * GC mode, the real build, the schedule's PR 13b: Tell the trades (to-dos/gc-mode/mockups/schedule-pr13.md on branch
 * spike/gc-mode). Ported from the GC mode prototype's `GcTellTrades` (`GcScheduleMoves.proto.tsx`), its words kept: each
 * company whose days a standing move changed and who is not told yet (`companiesNotTold`, call 3), its email as it will
 * go, in the language it goes in (call 9), and one press. The prototype marked them told in its reducer; here the press
 * is `tellTheTrades`, the one sender and then the record (calls 1 and 2), and the window says who was told and who was
 * not, with why.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { datesMessage } from '../../lib/gc/schedule/tellTrades'
import { companiesNotTold } from '../../lib/gc/schedule/tellWindow'
import type { CompanyToTell } from '../../lib/gc/schedule/tellTrades'
import { tradeMailLang } from '../../lib/gc/tradeEmail'
import type { TellTheTrades } from '../../lib/gc/tellTradesIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { Btn } from './gcUi'

/** "a, b and c" */
function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export function GcTellTrades({
  state,
  project,
  onTell,
  onClose,
}: {
  state: GcState
  project: GcProject
  /** The press: every company shown, through the one sender and then the record. Never throws. */
  onTell: (companies: CompanyToTell[]) => Promise<TellTheTrades>
  onClose: () => void
}) {
  const companies = useMemo(() => companiesNotTold(state, project), [state, project])
  const moves = useMemo(() => new Set(companies.flatMap((c) => c.moves.map((m) => m.id))).size, [companies])
  const [picked, setPicked] = useState<string | null>(null)
  const [telling, setTelling] = useState(false)
  const [result, setResult] = useState<TellTheTrades | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const company = companies.find((c) => c.partner.id === picked) ?? companies[0]
  const message = company ? datesMessage(project, company.partner, company, tradeMailLang(company.partner.lang)) : null
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const tell = async () => {
    if (telling || companies.length === 0) return
    setTelling(true)
    try {
      setResult(await onTell(companies))
    } finally {
      setTelling(false)
    }
  }
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tell the trades"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(720px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Tell the trades their dates moved</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {result
              ? 'The schedule reads again with who was told.'
              : `${moves === 1 ? '1 move' : `${moves} moves`} not told yet. Each company gets one email, in its language, with its old and new days and why. It answers from its portal.`}
          </div>
        </div>
        {result ? (
          <div data-tell-result style={{ display: 'grid', gap: '0.4rem' }}>
            {result.told.length > 0 && <div style={{ color: 'var(--text-green-800)' }}>Told {andList(result.told.map((t) => t.company))}.</div>}
            {result.refused.map((r) => (
              <div key={r.companyId} style={{ color: 'var(--text-amber-800)' }}>
                {r.company} was not told. {r.words}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div role="group" aria-label="Companies to tell" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {companies.map((c) => {
                const on = company?.partner.id === c.partner.id
                return (
                  <button
                    key={c.partner.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(c.partner.id)}
                    style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-muted)' }}
                  >
                    {c.partner.company} · {c.lines.length === 1 ? '1 line' : `${c.lines.length} lines`}
                    {tradeMailLang(c.partner.lang) === 'es' ? ' · Español' : ''}
                  </button>
                )
              })}
            </div>
            {company && message && (
              <article data-tell-email style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem', background: 'var(--bg-subtle)' }}>
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>To </span>
                    {company.partner.contact ? `${company.partner.contact}, ${company.partner.company}` : company.partner.company}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{message.subject}</span>
                </div>
                <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.45rem', lineHeight: 1.45 }}>
                  {message.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </article>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          {result ? (
            <>
              <span style={{ flex: '1 1 10rem' }} />
              <Btn kind="primary" onClick={onClose}>
                Done
              </Btn>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
                {companies.length === 1 ? '1 email goes out' : `${companies.length} emails go out`}, each with the company&apos;s portal link.
              </span>
              <Btn kind="quiet" onClick={onClose}>
                Cancel
              </Btn>
              <Btn kind="primary" disabled={companies.length === 0 || telling} onClick={() => void tell()}>
                {telling ? 'Telling…' : companies.length === 1 ? `Tell ${companies[0]?.partner.company ?? 'them'}` : `Tell ${companies.length} companies`}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
