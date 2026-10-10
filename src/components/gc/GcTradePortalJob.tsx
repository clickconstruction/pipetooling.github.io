import { sowMoney } from '../../lib/gc/bids'
import { sowContractSum } from '../../lib/gc/building'
import { punchCounts, punchItems, punchState } from '../../lib/gc/buildingPunch'
import { portalRfis, rfiLabel, rfiState } from '../../lib/gc/buildingRfis'
import { submittalRowsOn, type SubmittalRow } from '../../lib/gc/buildingSubmittals'
import { bw, type BuildingWordKey } from '../../lib/gc/buildingWords'
import { GC_COMPANY } from '../../lib/gc/company'
import { portalOnSite } from '../../lib/gc/portal'
import { pDate, type PortalLang } from '../../lib/gc/portalI18n'
import type { GcProject, SubmittalKind, TradePackage } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Chip } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P5c-1, to-dos/gc-mode/mockups/portal-p5.md): the company's job once its statement of
 * work is signed, read only. From the design spike's `SowBlock` report (`GcTradePortal.tsx`), its pay application door's
 * punch and submittal boxes (`GcBuildingPunchForTrade`, `GcBuildingSubmittalsForTrade`) and `GcPortalRfis`: each line's
 * percent and what was paid through, its punch list, its submittals, its draws, and its questions while we build. The
 * presses come with their kinds: the punch list, submittals and questions in P5c-2, the report, the pay application and
 * the waivers in P5c-3. Until then a block whose press is not live shows where things stand and asks nothing.
 */

const GC = GC_COMPANY.shortName

const KIND_KEY: Record<SubmittalKind, BuildingWordKey> = { 'product data': 'subKindProduct', 'shop drawings': 'subKindShop', samples: 'subKindSamples' }

export function GcTradePortalJob({ project, pkg, partnerId, today }: { project: GcProject; pkg: TradePackage; partnerId: string; today: string }) {
  return (
    <>
      <Report project={project} pkg={pkg} today={today} />
      <Rfis project={project} pkg={pkg} partnerId={partnerId} />
    </>
  )
}

/** The report: each line's percent done and paid through, the punch list and submittals, the draws and the totals. */
function Report({ project, pkg, today }: { project: GcProject; pkg: TradePackage; today: string }) {
  const { lang, t } = usePortalLang()
  const sow = pkg.sow
  if (!sow || sow.status !== 'signed') return null
  const m = sowMoney(sow)
  const onSite = portalOnSite(project, pkg, today, lang)
  return (
    // A to-do about this work (the punch list, a submittal, a draw) lands here.
    <div data-portal-anchor={`report:${pkg.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('reportTitle', { trade: pkg.trade })}>
        <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
          {onSite && <div style={{ fontSize: '0.85rem', color: MUTED }}>{onSite}</div>}
          {sow.sov.map((l) => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'baseline' }}>
              <span>
                {l.label} <span style={{ color: MUTED }}>· {money(l.amount)} · {t('paidThrough', { pct: l.pctBilled })}</span>
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{t('pctDone', { pct: l.pctReported })}</strong>
            </div>
          ))}
          <Punch project={project} pkg={pkg} lang={lang} />
          <Submittals project={project} pkg={pkg} today={today} lang={lang} />
          {sow.draws.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{t('drawN', { n: d.number })}</strong>
              <span>
                {money(d.net)}
                {d.asked && <span style={{ color: MUTED }}> {t('drawOfAsked', { asked: money(d.asked.net) })}</span>}
                {(d.backCharges ?? []).length > 0 && (
                  <span style={{ color: MUTED }}> {t('bcOffDraw', { amount: money((d.backCharges ?? []).reduce((sum, c) => sum + c.amount, 0)) })}</span>
                )}
              </span>
              <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>
                {d.status === 'requested' ? t('drawReviewing', { gc: GC }) : d.status === 'approved' ? t('drawApproved') : t('drawPaid')}
              </Chip>
            </div>
          ))}
          <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('sowTotals', { paid: money(m.paid), held: money(m.retainageHeld), left: money(sowContractSum(sow) - m.billed) })}</div>
        </div>
      </PortalBlock>
    </div>
  )
}

const box = { padding: '0.55rem 0.65rem', border: `1px solid ${HAIR}`, borderRadius: 6, display: 'grid', gap: '0.45rem' } as const

/** Its punch list: each item not checked yet, and what we sent back. */
function Punch({ project, pkg, lang }: { project: GcProject; pkg: TradePackage; lang: PortalLang }) {
  const w = (key: BuildingWordKey, vars?: Record<string, string | number>) => bw(lang, key, { gc: GC, ...vars })
  const items = punchItems(project, pkg.id)
  const c = punchCounts(project, pkg.id)
  if (c.open + c.fixed === 0) return null
  return (
    <div style={box}>
      <div>
        <strong>{w('punchHead')}</strong>
        {c.open > 0 && <span style={{ color: 'var(--text-amber-800)' }}> · {w('punchToFix', { n: c.open })}</span>}
      </div>
      {items
        .filter((i) => punchState(i) !== 'done')
        .map((item) => (
          <div key={item.id} style={{ display: 'grid', gap: '0.2rem' }}>
            <div>
              {item.text}
              {item.where ? <span style={{ color: MUTED }}> · {item.where}</span> : null}
            </div>
            {item.sentBack && punchState(item) === 'open' && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>
                {w('punchBack', { date: pDate(lang, item.sentBack.on) })}
                {item.sentBack.note ? ` “${item.sentBack.note}”` : ''}
              </div>
            )}
            {punchState(item) === 'fixed' && <div style={{ fontSize: '0.85rem', color: MUTED }}>{w('punchWaiting')}</div>}
          </div>
        ))}
      {c.done > 0 && <div style={{ fontSize: '0.85rem', color: MUTED }}>{w('punchChecked', { n: c.done })}</div>}
      {/* punchWhy ("tell Click here") comes back with It is fixed, the press it names (P5c-2). */}
    </div>
  )
}

/** Its submittals still open: each with what it needs, what came back, and where it is. */
function Submittals({ project, pkg, today, lang }: { project: GcProject; pkg: TradePackage; today: string; lang: PortalLang }) {
  const w = (key: BuildingWordKey, vars?: Record<string, string | number>) => bw(lang, key, { gc: GC, ...vars })
  const rows = submittalRowsOn(project, today).filter((r) => r.submittal.packageId === pkg.id)
  const open = rows.filter((r) => r.state !== 'approved')
  if (open.length === 0) return null
  const approved = rows.length - open.length
  return (
    <div style={box}>
      <strong>{w('subHead')}</strong>
      {open.map((r) => (
        <SubmittalLine key={r.submittal.id} row={r} lang={lang} w={w} />
      ))}
      {approved > 0 && <div style={{ fontSize: '0.85rem', color: MUTED }}>{w('subApproved', { n: approved })}</div>}
    </div>
  )
}

function SubmittalLine({ row, lang, w }: { row: SubmittalRow; lang: PortalLang; w: (key: BuildingWordKey, vars?: Record<string, string | number>) => string }) {
  const s = row.submittal
  const last = s.rounds[s.rounds.length - 1]
  return (
    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
      <div>
        <strong>{s.number}</strong> {s.title} <span style={{ color: MUTED }}>· {w(KIND_KEY[s.kind])}</span>
      </div>
      {row.neededBy && row.state === 'trade' && (
        <div style={{ color: row.daysLate > 0 ? 'var(--text-red-700)' : MUTED }}>
          {w('subNeeded', { date: pDate(lang, row.neededBy) })}
          {row.daysLate > 0 ? ` ${w('subLate', { n: row.daysLate })}` : ''}
        </div>
      )}
      {row.state === 'trade' && last?.answer === 'revise' && last.answeredOn && (
        <div style={{ color: 'var(--text-amber-800)' }}>
          {w('subBack', { date: pDate(lang, last.answeredOn) })}
          {last.answerNote ? ` “${last.answerNote}”` : ''}
        </div>
      )}
      {row.state === 'us' && last && <div style={{ color: MUTED }}>{w('subWithUs', { date: pDate(lang, last.sentOn) })}</div>}
      {row.state === 'architect' && last?.toArchitectOn && <div style={{ color: MUTED }}>{w('subWithArchitect', { date: pDate(lang, last.toArchitectOn) })}</div>}
    </div>
  )
}

/**
 * Its questions while we build: each one it asked or that is about its trade, where it stands, and the answer. The day an
 * answer is needed by reads the schedule, which joins the slice with the schedule's kinds (P5d); until then it is left out.
 */
function Rfis({ project, pkg, partnerId }: { project: GcProject; pkg: TradePackage; partnerId: string }) {
  const { lang, t } = usePortalLang()
  const rfis = portalRfis(project, pkg.id, partnerId)
  if (rfis.length === 0) return null
  return (
    <PortalBlock title={t('rfiTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        {rfis.map((rfi, i) => {
          const st = rfiState(rfi)
          return (
            <div key={rfi.id} style={{ display: 'grid', gap: '0.2rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{rfiLabel(rfi)}</strong>
                <Chip tone={st === 'answered' ? 'green' : st === 'architect' ? 'blue' : 'amber'}>
                  {st === 'answered' ? t('rfiChipAnswered') : st === 'architect' ? t('rfiChipArchitect') : t('rfiChipUs', { gc: GC })}
                </Chip>
              </div>
              <span>{rfi.question}</span>
              <span style={{ fontSize: '0.82rem', color: MUTED }}>
                {rfi.answer
                  ? t('rfiAnswered', { date: pDate(lang, rfi.answer.on), answer: rfi.answer.text })
                  : t(st === 'architect' ? 'rfiWithArchitect' : 'rfiWithUs', { date: pDate(lang, rfi.askedOn), gc: GC })}
              </span>
            </div>
          )
        })}
      </div>
    </PortalBlock>
  )
}
