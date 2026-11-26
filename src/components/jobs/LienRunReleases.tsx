import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { MoneyText } from '../Money'
import { useToastContext } from '../../contexts/ToastContext'
import { batchOutcomeWords } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { readLienPayoffFacts } from '../../lib/jobs/lienPayoffIo'
import type { LienPayoffFacts } from '../../lib/jobs/lienPayoff'
import { releaseByNow } from '../../lib/jobs/lienReleaseFacts'
import { RELEASE_RUN_WORDS as WORDS, buildLienReleaseRun, copiesDayCheck, notarizedDayCheck, type ReleaseRunLine, type ReleaseRunStage } from '../../lib/jobs/lienReleaseRun'
import { RELEASE_RUN_NO_PAPER, RELEASE_RUN_PRINT_KIND, keepReleaseFacts, releaseRunCopyHtml, releaseRunPrintHtml, releaseRunPrintable, releaseRunTitle } from '../../lib/jobs/lienReleaseRunIo'
import { filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import { formatErrorMessage } from '../../utils/errorHandling'

export type LienRunReleasesProps = {
  todayYmd: string
  /** The desk's data: the releases are read again whenever it changes. */
  refreshKey: unknown
  isMobile: boolean
  /** The company block the papers print under. */
  issuer: Parameters<typeof filingLetterheadFromIssuer>[0]
  /** Who is signed in, kept with each press. Null, or a viewer outside the lien office, sees the list with no press. */
  who: { id: string; name: string } | null
  /** The job's Lien window on its Release of record tab, where the county's stamp is typed. */
  onOpenRelease?: (jobId: string) => void
  /** A release changed: the desk reads again. */
  onChanged?: () => void
  read?: typeof readLienPayoffFacts
  keep?: typeof keepReleaseFacts
  print?: (html: string) => boolean
  file?: typeof fileSentCopy
}

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', padding: '12px 14px', minWidth: 0 }
const small: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const blueBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const deadBtn: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const plainBtn: CSSProperties = { ...blueBtn, background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)' }
const linkBtn: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', borderRadius: 3 }
const chip: CSSProperties = { display: 'inline-block', padding: '0 6px', borderRadius: 5, border: '1px solid var(--border-strong)', fontSize: '0.72rem', fontWeight: 700, lineHeight: '18px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-700)', background: 'var(--bg-subtle)' }

const STAGES: ReadonlyArray<ReleaseRunStage> = ['print', 'notary', 'county', 'copies']
const NOUN = ['release', 'releases'] as const
const VALUES = { money: (t: string) => <WorkedOutValue><MoneyText text={t} bare /></WorkedOutValue> }

/**
 * The releases on the run (punch list #435, piece 5): every saved release of a filed lien under the act it is on,
 * drawn with the run's *Out the door* step. One press prints the ready ones for the notary and holds the rest with
 * the reason; the notary's day and the copies' day are values changed where they sit; the county's stamp opens the
 * release's own tab. The rule is `lienReleaseRun.ts`. Draws nothing while no saved release has an act left.
 */
export default function LienRunReleases({ todayYmd, refreshKey, isMobile, issuer, who, onOpenRelease, onChanged, read = readLienPayoffFacts, keep = keepReleaseFacts, print = openHtmlPrintWindow, file = fileSentCopy }: LienRunReleasesProps) {
  const { showToast } = useToastContext()
  const [facts, setFacts] = useState<LienPayoffFacts | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Releases the last print left out because their row holds no paper. */
  const [noPaper, setNoPaper] = useState<ReadonlyArray<string>>([])
  const seq = useRef(0)
  const load = useCallback(async () => {
    const mine = ++seq.current
    try {
      const next = await read(todayYmd)
      if (mine !== seq.current) return
      setFacts(next)
      setFailure(null)
    } catch (e) {
      if (mine === seq.current) setFailure(formatErrorMessage(e, 'The releases could not be read.'))
    }
  }, [read, todayYmd])
  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const run = useMemo(() => (facts ? buildLienReleaseRun(facts) : null), [facts])
  const tall: CSSProperties = isMobile ? { minHeight: 44 } : {}
  const after = () => {
    void load()
    onChanged?.()
  }

  /** One value kept on one release: a failure is thrown, so the open field says why. */
  const keepOne = async (line: ReleaseRunLine, change: Parameters<typeof keepReleaseFacts>[1]) => {
    const [outcome] = await keep([{ releaseId: line.releaseId, fields: line.fields }], change)
    if (!outcome?.ok) throw new Error(outcome?.why ?? WORDS.failed)
    showToast(WORDS.kept, 'success')
    after()
  }

  const printReady = async () => {
    if (!run || !who || busy || run.print.dead) return
    const opts = { letterhead: filingLetterheadFromIssuer(issuer), todayYmd }
    const { printable, noPaper: bare } = releaseRunPrintable(run.print.ready)
    setNoPaper(bare.map((l) => l.releaseId))
    const html = releaseRunPrintHtml(printable, opts)
    if (!html) {
      showToast(RELEASE_RUN_NO_PAPER, 'error')
      return
    }
    // The window opens inside the press. A blocked one prints nothing, so nothing is marked or filed.
    if (!print(html)) {
      showToast(WORDS.popup, 'error')
      return
    }
    setBusy(true)
    try {
      for (const l of printable) {
        const copy = releaseRunCopyHtml(l, opts)
        void file({ kind: RELEASE_RUN_PRINT_KIND, title: releaseRunTitle(l), jobIds: [l.jobId], how: 'print' }, copy ? { html: copy } : null)
      }
      const outcomes = await keep(printable.map((l) => ({ releaseId: l.releaseId, fields: l.fields })), { printed: releaseByNow(who, new Date().toISOString()) })
      const done = outcomes.filter((o) => o.ok).length
      const words = batchOutcomeWords({ verb: 'take the mark', past: 'printed', done, failed: outcomes.length - done, noun: NOUN })
      showToast(words.line, words.tone === 'success' ? 'success' : words.tone === 'warning' ? 'info' : 'error')
      after()
    } finally {
      setBusy(false)
    }
  }

  if (failure) {
    return (
      <section data-lien-run-card="releases" data-state="failed" role="alert" style={{ ...card, border: '1px solid var(--border-red)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: '0.8125rem' }}>
        <span style={{ flex: '1 1 16rem', color: 'var(--text-red-700)' }}>{failure}</span>
        <button type="button" data-lien-run-releases-retry onClick={() => void load()} style={{ ...plainBtn, ...tall }}>
          Try again
        </button>
      </section>
    )
  }
  if (!run || !run.show) return null

  const line = (l: ReleaseRunLine) => (
    <div key={l.releaseId} data-lien-run-release={l.releaseId} data-held={l.heldKind ?? ''} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 3, fontSize: '0.8125rem' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={chip}>{l.jobNumber}</span>
        <b style={{ color: 'var(--text-strong)' }}>{l.jobName || l.place}</b>
        {l.instrument ? <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>releases instrument {l.instrument}</span> : null}
      </div>
      {l.note ? (
        <div data-lien-run-release-note style={small}>
          <ValueSentence text={l.note} />
        </div>
      ) : null}
      {l.held ? (
        <div data-lien-run-release-held style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
          <ValueSentence text={l.held} values={VALUES} />
        </div>
      ) : null}
      {noPaper.includes(l.releaseId) ? (
        <div data-lien-run-release-no-paper style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
          {RELEASE_RUN_NO_PAPER}
        </div>
      ) : null}
      {who && (l.stage === 'print' || l.stage === 'notary') && !l.held ? (
        <ValueLines>
          <ValueLine label={WORDS.notarized}>
            <ChangeableValue text={WORDS.notYet} label={WORDS.notarizedLabel} type="date" value="" max={todayYmd} check={(draft) => notarizedDayCheck(draft, l.madeYmd, todayYmd)} onKeep={(value) => keepOne(l, { notarizedYmd: value })} />
          </ValueLine>
        </ValueLines>
      ) : null}
      {who && l.stage === 'county' ? (
        <ValueLines>
          <ValueLine label={WORDS.notarized}>
            <ChangeableValue text={formatYmdMonthDay(l.facts.notarizedYmd)} label={WORDS.notarizedLabel} type="date" value={l.facts.notarizedYmd} canClear max={todayYmd} check={(draft) => notarizedDayCheck(draft, l.madeYmd, todayYmd)} onKeep={(value) => keepOne(l, { notarizedYmd: value })} />
          </ValueLine>
        </ValueLines>
      ) : null}
      {who && l.stage === 'copies' ? (
        <ValueLines>
          <ValueLine label={WORDS.copies}>
            <ChangeableValue text={WORDS.notYet} label={WORDS.copiesLabel} type="date" value="" max={todayYmd} check={(draft) => copiesDayCheck(draft, l.recordedYmd, todayYmd)} onKeep={(value) => keepOne(l, { copies: value ? { ...releaseByNow(who, new Date().toISOString()), ymd: value } : null })} />
          </ValueLine>
        </ValueLines>
      ) : null}
      {onOpenRelease && (l.stage === 'county' || l.held) ? (
        <div>
          <button type="button" data-lien-run-release-open onClick={() => onOpenRelease(l.jobId)} style={{ ...linkBtn, ...tall }}>
            {l.stage === 'county' && !l.held ? WORDS.countyPress : WORDS.openPress}
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <section data-lien-run-card="releases" style={card}>
      <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{WORDS.head}</h3>
      <p data-lien-run-releases-tally style={{ ...small, margin: '4px 0 2px' }}>
        <ValueSentence text={run.tally} />
      </p>
      <p style={{ ...small, margin: '0 0 10px' }}>{WORDS.lead}</p>
      {STAGES.filter((s) => run.lines[s].length > 0).map((s, i) => (
        <div key={s} data-lien-run-releases={s} style={{ marginTop: i > 0 ? 14 : 0 }}>
          <b style={{ display: 'block', color: 'var(--text-strong)', fontSize: '0.85rem' }}>
            {WORDS.stages[s]} · <WorkedOutValue>{String(run.lines[s].length)}</WorkedOutValue> {run.lines[s].length === 1 ? NOUN[0] : NOUN[1]}
          </b>
          <p style={{ ...small, margin: '2px 0 4px' }}>{WORDS.stageLead[s]}</p>
          {s === 'print' && who ? (
            <div style={{ display: 'grid', gap: 3, justifyItems: 'start', margin: '6px 0 2px' }}>
              <button type="button" data-lien-run-releases-print disabled={run.print.dead || busy} onClick={() => void printReady()} style={{ ...blueBtn, ...(run.print.dead || busy ? deadBtn : {}), ...tall }}>
                {busy ? 'Printing…' : run.print.button}
              </button>
              {run.print.foot ? (
                <span data-lien-run-releases-print-foot style={small}>
                  {run.print.foot}
                </span>
              ) : null}
            </div>
          ) : null}
          {run.lines[s].map(line)}
        </div>
      ))}
    </section>
  )
}
