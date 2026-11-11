import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { shortDay } from '../../lib/research/permitResearch'
import { sitePermitLines as feedLines, type SitePermit } from '../../lib/research/permitPublic'
import { loadPermitsOfBuilder, loadResearchers, saveBuilder } from '../../lib/research/permitResearchIo'
import { loadBuilderKinds, loadNameAnswers, onNameAnswered, recordNameAnswer } from '../../lib/research/bidSiteIo'
import { SOMEONE_ELSE_KINDS, answeredWords, foldNameAnswers, nameGrade, nameStanding, questionWords, standingChip, tiePreviewWords, wordOfWords, type NameAnswerRow, type NameStanding } from '../../lib/research/nameAnswers'
import type { BuilderKind } from '../../lib/research/permitBuilders'
import type { SitePermitRow } from '../../lib/research/bidSitePanel'
import { PermitChip } from './PermitChip'

/**
 * The answer on a name (punch list #307, PR 6): under the permit that looks like a bid's job,
 * one question, asked once. *The city lists Dana Whitlow on this permit. Do you know who that
 * is?* Works for the GC, Someone else, Not sure. "Works for" shows the name's other permits
 * before it ties any, with This permit only beside it, since one person can file for more than
 * one builder. Every answer keeps who gave it and can be undone here. When the name begins the
 * GC's own, or is begun by it, the question reads *Same company?* instead: the likely grade,
 * the same three answers and the same rows.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const primary: CSSProperties = { background: '#2563eb', color: '#fff', border: '1px solid #2563eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit' }
const ghost: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit' }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }

type Step = 'ask' | 'preview' | 'who'
type Known = { rows: NameAnswerRow[]; me: string | null; kinds: Map<string, string | null>; people: Map<string, string> }

export function BidNameQuestion({ permit, city, customerIds, customerName }: { permit: SitePermitRow; city: string; customerIds: readonly string[]; customerName: string }) {
  const [known, setKnown] = useState<Known | null>(null)
  const [step, setStep] = useState<Step>('ask')
  const [others, setOthers] = useState<SitePermit[] | null>(null)
  const [busy, setBusy] = useState(false)
  // A person who said Not sure can answer after all.
  const [reopened, setReopened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idsKey = [...customerIds].sort().join(',')
  const today = todayYmdInAppTz()
  const customerId = customerIds[0] ?? null
  const permitKey = permit.builder_key

  const load = useCallback(async () => {
    const answers = await loadNameAnswers(idsKey === '' ? [] : idsKey.split(','))
    // Before the table is on the database there is nothing to ask.
    if (answers == null) return setKnown(null)
    const [kinds, researchers] = await Promise.all([loadBuilderKinds(permitKey ? [permitKey] : []), loadResearchers()])
    setKnown({ rows: answers.rows, me: answers.me, kinds, people: new Map(researchers.map((r) => [r.id, r.name])) })
  }, [idsKey, permitKey])

  useEffect(() => {
    let live = true
    load().catch(() => {
      if (live) setKnown(null)
    })
    const off = onNameAnswered(() => {
      void load().catch(() => {})
    })
    return () => {
      live = false
      off()
    }
  }, [load])

  const standing: NameStanding | null = useMemo(() => {
    if (!known) return null
    return nameStanding(permit, customerName, foldNameAnswers(known.rows, idsKey.split(',')), known.me, known.kinds)
  }, [known, permit, customerName, idsKey])

  const key = standing && standing.kind !== 'nobody' ? standing.key : null

  // The name's other permits, read when the preview opens and once a tie stands.
  useEffect(() => {
    if (!key || !(step === 'preview' || standing?.kind === 'tied')) return
    let live = true
    loadPermitsOfBuilder(city, key, today)
      .then((list) => {
        if (live) setOthers(list.filter((p) => p.id !== permit.id))
      })
      .catch(() => {
        if (live) setOthers([])
      })
    return () => {
      live = false
    }
  }, [key, step, standing?.kind, city, today, permit.id])

  if (!known || !standing || standing.kind === 'nobody' || !customerId || !key) return null
  const name = standing.name

  const answer = async (input: { answer: 'works_for' | 'someone_else' | 'not_sure' | 'taken_back'; scope?: 'all' | 'this_permit'; kind?: BuilderKind | null }) => {
    setBusy(true)
    setError(null)
    try {
      await recordNameAnswer({ builderKey: key, customerId, answer: input.answer, scope: input.scope ?? null, permitId: permit.id, name })
      if (input.answer === 'someone_else' && input.kind && known.me) await saveBuilder(key, name, input.kind, known.me)
      setStep('ask')
      setReopened(false)
      await load()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const failed = error ? <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div> : null
  const chip = standingChip(standing, customerName)
  const otherCount = others?.length ?? 0

  // Settled, or this person passed: one line, and Undo where an answer stands.
  if (standing.kind !== 'ask' && !(standing.kind === 'not_sure' && reopened)) {
    const word = standing.kind === 'tied' || standing.kind === 'someone_else' ? wordOfWords(standing.by, standing.at, known.me, (id) => known.people.get(id) ?? null) : ''
    const said = answeredWords(standing, customerName, otherCount, word)
    return (
      <div style={{ display: 'grid', gap: 6, marginTop: 4 }} data-testid="bid-name-question">
        {chip && (
          <div>
            <PermitChip chip={chip} />
          </div>
        )}
        {said && (
          <div style={{ background: standing.kind === 'tied' ? 'var(--bg-green-tint)' : 'var(--bg-200)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8125rem', lineHeight: 1.45, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 220px' }}>{said}</span>
            {(standing.kind === 'tied' || standing.kind === 'someone_else') && (
              <button type="button" disabled={busy} onClick={() => void answer({ answer: 'taken_back' })} style={linkPress}>
                Undo
              </button>
            )}
            {standing.kind === 'not_sure' && (
              <button type="button" onClick={() => setReopened(true)} style={linkPress}>
                Answer it
              </button>
            )}
          </div>
        )}
        {failed}
      </div>
    )
  }

  // The likely grade asks Same company?; a person who passed and came back is asked the same way.
  const grade = standing.kind === 'ask' ? standing.grade : nameGrade(name, customerName)
  const q = questionWords(name, customerName, grade)
  const box: CSSProperties = { background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8, marginTop: 4, fontSize: '0.8125rem', lineHeight: 1.45 }

  if (step === 'preview') {
    const preview = tiePreviewWords(name, customerName, otherCount, grade)
    const lines = others ? feedLines(others, null).slice(0, 3) : []
    return (
      <div style={box} data-testid="bid-name-question">
        {others == null ? (
          <div style={muted}>Reading {name}’s other permits…</div>
        ) : (
          <>
            <div style={{ fontWeight: 600 }}>{preview.lead}</div>
            {lines.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '3px 10px' }}>
                {lines.map((l) => (
                  <span key={l.id} style={{ display: 'contents' }}>
                    <span style={muted}>{l.day ? shortDay(l.day) : '—'}</span>
                    <span>{[l.what, l.where].filter(Boolean).join(' · ')}</span>
                  </span>
                ))}
              </div>
            )}
            {otherCount > lines.length && <div style={muted}>and {otherCount - lines.length} more</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => void answer({ answer: 'works_for', scope: 'all' })} style={primary}>
                {preview.all}
              </button>
              {preview.one && (
                <button type="button" disabled={busy} onClick={() => void answer({ answer: 'works_for', scope: 'this_permit' })} style={ghost}>
                  {preview.one}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => setStep('ask')} style={linkPress}>
                Back
              </button>
            </div>
            <div style={{ ...muted, color: 'var(--text-amber-800)' }}>{preview.why}</div>
          </>
        )}
        {failed}
      </div>
    )
  }

  if (step === 'who') {
    return (
      <div style={box} data-testid="bid-name-question">
        <div style={{ fontWeight: 600 }}>Who is {name}?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SOMEONE_ELSE_KINDS.map((k) => (
            <button key={k.words} type="button" disabled={busy} onClick={() => void answer({ answer: 'someone_else', kind: k.kind })} style={ghost}>
              {k.words}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={() => setStep('ask')} style={linkPress}>
            Back
          </button>
        </div>
        <div style={{ ...muted, color: 'var(--text-amber-800)' }}>Each one says {name} does not work for {customerName}. The kind shows on Builders.</div>
        {failed}
      </div>
    )
  }

  return (
    <div style={box} data-testid="bid-name-question">
      <div>
        <strong>{q.lead}</strong> {q.ask}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => setStep('preview')} style={primary}>
          {q.worksFor}
        </button>
        <button type="button" disabled={busy} onClick={() => setStep('who')} style={ghost}>
          {q.someoneElse}
        </button>
        <button type="button" disabled={busy} onClick={() => void answer({ answer: 'not_sure' })} style={ghost}>
          Not sure
        </button>
      </div>
      <div style={{ ...muted, color: 'var(--text-amber-800)' }}>{q.why}</div>
      {failed}
    </div>
  )
}
