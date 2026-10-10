import { useState, type ReactNode } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import { LienWaiverFootPreview } from '../jobs/LienWaiverFootPreview'
import { esignConsentText } from '../../lib/esignConsent'
import { sowMoney } from '../../lib/gc/bids'
import { sowContractSum, tradeChangesFor } from '../../lib/gc/building'
import { punchCounts, punchItems, punchState } from '../../lib/gc/buildingPunch'
import { portalCanAskRfi, portalRfis, rfiLabel, rfiState } from '../../lib/gc/buildingRfis'
import { submittalRowsOn, type SubmittalRow } from '../../lib/gc/buildingSubmittals'
import { bw, type BuildingWordKey } from '../../lib/gc/buildingWords'
import { GC_COMPANY } from '../../lib/gc/company'
import { WAIVER_SIGN_LIVE } from '../../lib/gc/drawEmail'
import { portalOnSite } from '../../lib/gc/portal'
import { pDate, type PortalLang } from '../../lib/gc/portalI18n'
import { tradeWaiverPaper } from '../../lib/gc/tradeWaiverPaper'
import type { Draw, GcProject, SovLine, SubmittalKind, TradePackage } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P5c-1, to-dos/gc-mode/mockups/portal-p5.md): the company's job once its statement of
 * work is signed, read only. From the design spike's `SowBlock` report (`GcTradePortal.tsx`), its pay application door's
 * punch and submittal boxes (`GcBuildingPunchForTrade`, `GcBuildingSubmittalsForTrade`) and `GcPortalRfis`: each line's
 * percent and what was paid through, its punch list, its submittals, its draws, and its questions while we build. Since
 * P5c-2 the company marks a punch item fixed (`punch_fixed`), sends a submittal round (`submittal_send`, its file a name and
 * a Drive link until P5a's upload) and asks a question (`rfi_ask`). Since P5c-3b it reports each line's percent
 * (`sow_report`) and signs a change we sent it (`sign_change`), typed with the e-sign consent. The unconditional waiver on
 * a paid draw (`unconditional_waiver`), on the app's own waiver paper, is drawn only once `WAIVER_SIGN_LIVE` is on, the
 * owner's call. The pay application gets its window in P5c-3c.
 */

const GC = GC_COMPANY.shortName

const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const
const FIELD = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const

const KIND_KEY: Record<SubmittalKind, BuildingWordKey> = { 'product data': 'subKindProduct', 'shop drawings': 'subKindShop', samples: 'subKindSamples' }

export function GcTradePortalJob({ project, pkg, partnerId, company, today }: { project: GcProject; pkg: TradePackage; partnerId: string; company: string; today: string }) {
  return (
    <>
      <Report project={project} pkg={pkg} company={company} today={today} />
      <Rfis project={project} pkg={pkg} partnerId={partnerId} />
    </>
  )
}

/**
 * The report: each line's percent done and paid through, the punch list and submittals, the changes to sign, the draws
 * and the totals. A line's percent is a picker while we build the job; otherwise it reads as text.
 */
function Report({ project, pkg, company, today }: { project: GcProject; pkg: TradePackage; company: string; today: string }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const sow = pkg.sow
  if (!sow || sow.status !== 'signed') return null
  const m = sowMoney(sow)
  const onSite = portalOnSite(project, pkg, today, lang)
  const canReport = Boolean(press) && project.stage === 'building' && !project.closedOn
  return (
    // A to-do about this work (the punch list, a submittal, a draw) lands here.
    <div data-portal-anchor={`report:${pkg.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('reportTitle', { trade: pkg.trade })}>
        <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
          {onSite && <div style={{ fontSize: '0.85rem', color: MUTED }}>{onSite}</div>}
          {sow.sov.map((l) => (
            <ReportLine key={l.id} line={l} packageId={pkg.id} canReport={canReport} />
          ))}
          <Punch project={project} pkg={pkg} lang={lang} />
          <Submittals project={project} pkg={pkg} today={today} lang={lang} />
          <ChangesToSign project={project} pkg={pkg} lang={lang} />
          {sow.draws.map((d) => (
            <div key={d.id} style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                {d.status === 'paid' && d.waiver === 'unconditional' && <span style={{ fontSize: '0.8rem', color: MUTED }}>{t(d.final ? 'uncondFinalSigned' : 'uncondSigned')}</span>}
              </div>
              {WAIVER_SIGN_LIVE && d.status === 'paid' && d.waiver === 'conditional' && press && <SignWaiver draw={d} project={project} company={company} today={today} />}
            </div>
          ))}
          <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('sowTotals', { paid: money(m.paid), held: money(m.retainageHeld), left: money(sowContractSum(sow) - m.billed) })}</div>
        </div>
      </PortalBlock>
    </div>
  )
}

const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

/**
 * A line's percent done (`sow_report`): a picker by tens that never goes below what was billed, as the SQL holds it, with
 * the percent last reported kept when it is not a ten. A split line is refused in splitLine's words until the schedule's
 * parts reach the portal (P5d).
 */
function ReportLine({ line, packageId, canReport }: { line: SovLine; packageId: string; canReport: boolean }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [picked, setPicked] = useState<number | null>(null)
  const pcts = [...new Set([...PCTS.filter((p) => p >= line.pctBilled), line.pctReported])].sort((a, b) => a - b)
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'baseline' }}>
        <span>
          {line.label} <span style={{ color: MUTED }}>· {money(line.amount)} · {t('paidThrough', { pct: line.pctBilled })}</span>
        </span>
        {canReport ? (
          <select
            value={picked ?? line.pctReported}
            disabled={busy}
            onChange={(e) => {
              const pct = Number(e.target.value)
              setPicked(pct)
              void run('sow_report', { packageId, line: line.id, pct }).then(() => setPicked(null))
            }}
            style={input}
            aria-label={t('percentAria', { line: line.label })}
          >
            {pcts.map((p) => (
              <option key={p} value={p}>
                {t('pctDone', { pct: p })}
              </option>
            ))}
          </select>
        ) : (
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{t('pctDone', { pct: line.pctReported })}</strong>
        )}
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}

const box = { padding: '0.55rem 0.65rem', border: `1px solid ${HAIR}`, borderRadius: 6, display: 'grid', gap: '0.45rem' } as const

/** The changes we sent it to sign: what each adds or takes off, and its signature, which makes it a line of the work. */
function ChangesToSign({ project, pkg, lang }: { project: GcProject; pkg: TradePackage; lang: PortalLang }) {
  const press = usePortalPress()
  const w = (key: BuildingWordKey, vars?: Record<string, string | number>) => bw(lang, key, { gc: GC, ...vars })
  const sent = tradeChangesFor(project, pkg).filter((c) => c.state === 'sent')
  if (sent.length === 0) return null
  return (
    <>
      {sent.map(({ co }) => {
        const what = co.description.trim().replace(/[.\s]+$/, '')
        return (
          <div key={co.id} style={box}>
            <div>
              <strong>{w('changeTo', { n: co.number })}</strong> {what ? `${what}. ` : ''}
              {co.cost < 0 ? w('changeTakes', { amount: money(-co.cost) }) : w('changeAdds', { amount: money(co.cost) })}
            </div>
            {press && <SignChange changeOrderId={co.id} label={w('signChange')} />}
          </div>
        )
      })}
    </>
  )
}

/**
 * A typed name and the e-sign consent on one paper, behind its button; a refusal shows under the form. A paper of its own
 * (the waiver's) sits above the form with a plain line explaining it, and shows the name as it is typed.
 */
function SignPaper({
  label,
  explain = null,
  paper = null,
  disclosure,
  agree,
  noun,
  onSign,
  busy,
  problem,
}: {
  label: string
  explain?: string | null
  paper?: ((printedName: string) => ReactNode) | null
  disclosure: string
  agree: string
  noun: string
  onSign: (printedName: string, consent: Record<string, unknown> | undefined) => void
  busy: boolean
  problem: string | null
}) {
  const { lang } = usePortalLang()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  if (!open) {
    return (
      <div>
        <Btn kind="primary" onClick={() => setOpen(true)}>
          {label}
        </Btn>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {explain && <div style={{ fontSize: '0.85rem' }}>{explain}</div>}
      {paper?.(name)}
      <ContractAcceptSignatureForm
        printedName={name}
        agreed={agreed}
        onPrintedNameChange={setName}
        onAgreedChange={setAgreed}
        formError={problem}
        submitting={busy}
        lockMode="type"
        onSubmit={(p) => onSign(p.printedName, p.consent ? { ...p.consent } : undefined)}
        heading={label}
        disclosure={disclosure}
        consent={esignConsentText({ audience: 'sub', lang, documentNoun: noun })}
        agreeLabel={agree}
        submitLabel={label}
        lang={lang}
      />
    </div>
  )
}

/** A change we sent, signed (`sign_change`): the SQL makes it a line of the statement of work. */
function SignChange({ changeOrderId, label }: { changeOrderId: string; label: string }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  return (
    <SignPaper
      label={label}
      disclosure={t('changeSignLead')}
      agree={t('changeSignAgree')}
      noun={t('changeConsentNoun')}
      busy={busy}
      problem={problem}
      onSign={(printedName, consent) => void run('sign_change', { changeOrderId, printedName, ...(consent ? { esignConsent: consent } : {}) })}
    />
  )
}

/**
 * The unconditional waiver on a paid draw (`unconditional_waiver`), or the unconditional final release on the final one.
 * The paper is the app's own (`tradeWaiverPaper`, the Release of Lien window's forms); the plain lines above it explain
 * it and are never the document. Drawn only once `WAIVER_SIGN_LIVE` is on. The signed paper as a file comes with P5a.
 */
function SignWaiver({ draw, project, company, today }: { draw: Draw; project: GcProject; company: string; today: string }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const final = Boolean(draw.final)
  return (
    <SignPaper
      label={t(final ? 'signUncondFinal' : 'signUncond')}
      explain={t(final ? 'uncondFinalLead' : 'uncondLead', { amount: money(draw.net), n: draw.number })}
      paper={(name) => <WaiverPaper draw={draw} project={project} company={company} signer={name} today={today} />}
      disclosure={t(final ? 'uncondFinalSignLead' : 'uncondSignLead')}
      agree={t(final ? 'uncondFinalAgree' : 'uncondAgree')}
      noun={t(final ? 'uncondFinalConsentNoun' : 'uncondConsentNoun')}
      busy={busy}
      problem={problem}
      onSign={(printedName, consent) => void run('unconditional_waiver', { drawId: draw.id, printedName, ...(consent ? { esignConsent: consent } : {}) })}
    />
  )
}

/** Its punch list: each item not checked yet, and what we sent back. */
function Punch({ project, pkg, lang }: { project: GcProject; pkg: TradePackage; lang: PortalLang }) {
  const press = usePortalPress()
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
            {punchState(item) === 'open' && press && <PunchFixed itemId={item.id} label={w('punchFixedBtn')} />}
          </div>
        ))}
      {c.done > 0 && <div style={{ fontSize: '0.85rem', color: MUTED }}>{w('punchChecked', { n: c.done })}</div>}
      {press && <div style={{ fontSize: '0.8rem', color: MUTED }}>{w('punchWhy')}</div>}
    </div>
  )
}

/** It is fixed: one press, and the page reads the slice again when it went through. */
function PunchFixed({ itemId, label }: { itemId: string; label: string }) {
  const { busy, problem, run } = usePress()
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <div>
        <Btn kind="primary" disabled={busy} onClick={() => void run('punch_fixed', { itemId })}>
          {label}
        </Btn>
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}

/** Its submittals still open: each with what it needs, what came back, and where it is, and the round it owes sent. */
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
      {row.state === 'trade' && <SendRound submittalId={s.id} w={w} />}
      {row.state === 'us' && last && <div style={{ color: MUTED }}>{w('subWithUs', { date: pDate(lang, last.sentOn) })}</div>}
      {row.state === 'architect' && last?.toArchitectOn && <div style={{ color: MUTED }}>{w('subWithArchitect', { date: pDate(lang, last.toArchitectOn) })}</div>}
    </div>
  )
}

/**
 * The round it owes, sent (`submittal_send`): the file's name, its Drive link if it has one, and a note. Until P5a's upload
 * the file itself goes by its link or by email; the SQL refuses a blank name (fileNeeded).
 */
function SendRound({ submittalId, w }: { submittalId: string; w: (key: BuildingWordKey, vars?: Record<string, string | number>) => string }) {
  const { t } = usePortalLang()
  const press = usePortalPress()
  const { busy, problem, run } = usePress()
  const [file, setFile] = useState('')
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  if (!press) return null
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <input value={file} onChange={(e) => setFile(e.target.value)} placeholder={w('subFile')} aria-label={w('subFile')} style={FIELD} />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('subDriveLink')} aria-label={t('subDriveLink')} inputMode="url" style={FIELD} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={w('subNote')} aria-label={w('subNote')} style={FIELD} />
      <div>
        <Btn
          kind="primary"
          disabled={busy || file.trim() === ''}
          onClick={() => {
            void run('submittal_send', { submittalId, fileName: file.trim(), driveUrl: link.trim(), note: note.trim() }).then((ok) => {
              if (ok) {
                setFile('')
                setLink('')
                setNote('')
              }
            })
          }}
        >
          {w('subSend')}
        </Btn>
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}

/**
 * Its questions while we build: each one it asked or that is about its trade, where it stands, and the answer, and since
 * P5c-2 a new one asked (`rfi_ask`) while the job is being built on a trade awarded to it. The day an answer is needed by
 * reads the schedule, which joins the slice with the schedule's kinds (P5d); until then it is left out.
 */
function Rfis({ project, pkg, partnerId }: { project: GcProject; pkg: TradePackage; partnerId: string }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const rfis = portalRfis(project, pkg.id, partnerId)
  const canAsk = Boolean(press) && portalCanAskRfi(project, pkg.id, partnerId)
  if (!canAsk && rfis.length === 0) return null
  return (
    <PortalBlock title={t('rfiTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        {canAsk && <AskRfi packageId={pkg.id} none={rfis.length === 0} />}
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

/** Ask: the question, the sheets it is about, and Send; the page reads the slice again when it went through. */
function AskRfi({ packageId, none }: { packageId: string; none: boolean }) {
  const { t } = usePortalLang()
  const { busy, problem, run, clear } = usePress()
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [sheets, setSheets] = useState('')
  if (!asking) {
    return (
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {none && <div style={{ color: MUTED }}>{t('rfiHelp', { gc: GC })}</div>}
        <div>
          <Btn kind="primary" onClick={() => setAsking(true)}>
            {t('rfiAsk', { gc: GC })}
          </Btn>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
        <strong>{t('rfiQuestion')}</strong>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('rfiQuestionHint')} rows={3} style={{ ...FIELD, resize: 'vertical' }} />
      </label>
      <input value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder={t('rfiSheets')} aria-label={t('rfiSheets')} style={FIELD} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={busy || question.trim() === ''}
          onClick={() => {
            const named = sheets
              .split(',')
              .map((x) => x.trim())
              .filter((x) => x !== '')
            void run('rfi_ask', { packageId, question: question.trim(), sheets: named }).then((ok) => {
              if (ok) {
                setAsking(false)
                setQuestion('')
                setSheets('')
              }
            })
          }}
        >
          {t('rfiSend', { gc: GC })}
        </Btn>
        <Btn
          kind="quiet"
          disabled={busy}
          onClick={() => {
            clear()
            setAsking(false)
          }}
        >
          {t('notNow')}
        </Btn>
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}

/** The waiver as the Release of Lien window draws its paper: the form's title, its paragraphs and the foot to sign on. */
function WaiverPaper({ draw, project, company, signer, today }: { draw: Draw; project: GcProject; company: string; signer: string; today: string }) {
  const paper = tradeWaiverPaper(draw, project, company, signer, today)
  return (
    <div
      data-trade-waiver-paper={paper.formType}
      style={{
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: `1px solid ${HAIR}`,
        borderRadius: 4,
        padding: '1rem 1.1rem',
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '0.8125rem',
        lineHeight: 1.7,
      }}
    >
      <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>{paper.title}</p>
      {paper.paragraphs.map((text, i) => (
        <p key={i} style={{ margin: '0 0 0.7em' }}>
          {text}
        </p>
      ))}
      <LienWaiverFootPreview foot={paper.foot} />
    </div>
  )
}
