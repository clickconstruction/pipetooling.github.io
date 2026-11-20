/**
 * The Development page's Schedule look (punch list #382, PR 5): every stage ahead on the site, each saying where it
 * stands in one sentence. A banner on top says what the customer owes us and how far they have moved. Under it is one
 * card a stage, sorted by trouble: red, then amber, green and grey, and by first day inside a colour. A card has a
 * coloured dot, the stage's name, our days, the ready bar with its list, one sentence with its values in place, and
 * one press that opens it to the four lines and the two lists (`StartCheckStage`). The look draws only on a site
 * where this person is on a job's desk and a job has a stage line. Nothing here reaches the GC.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { stageChecklistKindOf } from '../../lib/jobs/stageChecklist'
import { addDays, byTrouble, daySpan, daysBetween, readiness, readyList, readyMarks, scheduleLookWords, siteBanner, siteMovedWords, stageStanding, stagesToAsk, type NextPress, type ValueKind } from '../../lib/startChecks/startChecks'
import type { SiteStartChecksRead } from '../../hooks/useSiteStartChecks'
import type { StartWho } from '../../lib/startChecks/startChecksIo'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ReadyMarks } from '../startChecks/ReadyBar'
import { StartCheckAskPanel } from '../startChecks/StartCheckAskPanel'
import { StartCheckStage } from '../startChecks/StartCheckStage'
import { ChangeableValue, ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { Card, type CardFold } from './developmentPageBits'

const muted: CSSProperties = { color: 'var(--text-muted)' }
const plainPress: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const bluePress: CSSProperties = { ...plainPress, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }

/**
 * What the one press reads while the card is shut: whatever comes next. A person who may not decide is offered the
 * stage itself, and so is anyone when what comes next has no words: a bullet of ours the app reads has no press of its
 * own while it is being read, or where the app holds nothing to open for it.
 */
function pressWords(next: NextPress, label: string | null, mayDecide: boolean): string {
  if (next === 'none') return 'Open'
  if ((next === 'decide' || next === 'go') && !mayDecide) return 'Open'
  return label?.trim() || 'Open'
}
/** Where the open stage starts when the press named the ask or the decision. */
const startOnFor = (next: NextPress, mayDecide: boolean): 'ask' | 'decide' | null => (next === 'ask' ? 'ask' : (next === 'decide' || next === 'go') && mayDecide ? 'decide' : null)

export function DevelopmentScheduleCard({
  anchorId,
  developmentId,
  read,
  todayYmd,
  me,
  can,
  foldFor,
  contactLine,
  askCustomerId,
  jobNameOf,
}: {
  anchorId: string
  developmentId: string
  read: SiteStartChecksRead
  todayYmd: string
  me: StartWho
  can: { window: boolean; notice: boolean; company: boolean; decide: boolean }
  foldFor: (line: string) => CardFold
  /** Who the contact is, under the banner: "Ray Ortiz, the GC's contact on the bids". */
  contactLine: string | null
  /** The customer whose thread an ask opens in Messages, and each job's name for the box. Null: the site names no customer. */
  askCustomerId: string | null
  jobNameOf: (jobId: string) => string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [openOn, setOpenOn] = useState<'ask' | 'decide' | null>(null)
  const [asking, setAsking] = useState(false)
  const stages = useMemo(() => read.stages.map((s) => s.stage), [read.stages])
  const lineOf = useMemo(() => new Map(read.stages.map((s) => [s.stage.id, s.line])), [read.stages])
  const sorted = useMemo(() => byTrouble(stages, read.site, todayYmd), [stages, read.site, todayYmd])
  if (!read.shows) return null
  const words = scheduleLookWords(stages, read.site, todayYmd)
  const banner = siteBanner(stages, read.site, todayYmd)
  const moved = siteMovedWords(stages)
  // One ask covers every stage whose day to decide is near. Messages ties it to the first of them.
  const toAsk = stagesToAsk(stages, read.site, todayYmd).flatMap((stage) => {
    const line = lineOf.get(stage.id)
    return line ? [{ stage, line }] : []
  })
  const doorFor = (jobId: string) => ({ jobId, jobName: jobNameOf(jobId), customerId: askCustomerId })

  return (
    <Card id={anchorId} title="Schedule" fold={foldFor(words.need ? `${words.count} · ${words.need}` : words.count)} meta="what must be true before each stage, and where it stands">
      {read.failure ? (
        <OfflineRetryPanel failure={read.failure} onRetry={read.reload} surface="development-schedule" idempotent busy={read.loading} />
      ) : (
        <div data-development-schedule>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${banner.askLabel ? '#2563eb' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface)' }} data-schedule-banner>
            <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
              <div style={{ fontSize: '1rem', color: 'var(--text-strong)' }}>
                <ValueSentence text={banner.sentence} />
              </div>
              {contactLine || moved ? (
                <div style={{ fontSize: '0.8125rem', ...muted }}>
                  {contactLine}
                  {contactLine && moved ? ' ' : ''}
                  {moved}
                </div>
              ) : null}
            </div>
            {banner.askLabel && toAsk[0] ? (
              <button type="button" className="scPress" style={bluePress} aria-expanded={asking} onClick={() => setAsking(!asking)}>
                {banner.askLabel}
              </button>
            ) : null}
          </div>
          {asking && toAsk[0] ? <StartCheckAskPanel stages={toAsk} site={read.site} today={todayYmd} me={me} door={doorFor(toAsk[0].line.jobId)} press={read.press} onClose={() => setAsking(false)} /> : null}

          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {sorted.map((stage) => {
              const line = lineOf.get(stage.id)
              if (!line) return null
              const st = stageStanding(stage, read.site, todayYmd)
              const open = openId === stage.id
              const ready = readiness(stage.bullets)
              return (
                <div key={stage.id} className="scStageCard" data-light={st.light} data-schedule-stage={stage.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <span className="scDot" data-light={st.light} role="img" aria-label={st.headline} title={st.headline} />
                    <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '1rem' }}>
                        {stage.part ? `${stage.part} · ` : ''}
                        {stage.name}{' '}
                        <span style={{ fontWeight: 500, fontSize: '0.8125rem', ...muted }}>· {stage.window ? daySpan(stage.window[0], stage.window[1]) : 'no days yet'}</span>
                        <ReadyMarks list={readyList(stage)} marks={readyMarks(stage)} pct={ready.pct} urgent={st.light === 'red'} />
                      </div>
                      <div style={{ marginTop: 2, lineHeight: 1.7 }} data-schedule-sentence>
                        <ValueSentence<ValueKind>
                          text={st.sentence}
                          values={{
                            start: (text) =>
                              can.window && stage.window ? (
                                <ChangeableValue
                                  text={text}
                                  label="our first day"
                                  type="date"
                                  value={stage.window[0]}
                                  hint="our first day"
                                  onKeep={(v) => {
                                    // Our last day moves with our first, so the window keeps its length.
                                    const [first, last] = stage.window as [string, string]
                                    return read.press((w) => w.setWindow({ jobId: line.jobId, fixtureId: line.fixtureId }, v, addDays(v, Math.max(0, daysBetween(first, last))), me))
                                  }}
                                />
                              ) : null,
                            their: (text) => (
                              <ChangeableValue
                                text={text}
                                label="the day they say ready"
                                type="date"
                                value={stage.theirDays[stage.theirDays.length - 1]?.day ?? ''}
                                hint="a new day from them, kept beside the old one"
                                onKeep={(v) => read.press((w) => w.giveTheirDay({ jobId: line.jobId, fixtureId: line.fixtureId, readyDay: v, saidOn: todayYmd, who: read.site.contact, how: 'told us' }, me))}
                              />
                            ),
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="scPress"
                      style={open || st.next === 'none' || st.light === 'grey' ? plainPress : bluePress}
                      aria-expanded={open}
                      onClick={() => {
                        setOpenOn(open ? null : startOnFor(st.next, can.decide))
                        setOpenId(open ? null : stage.id)
                      }}
                    >
                      {open ? 'Close' : pressWords(st.next, st.nextLabel, can.decide)}
                    </button>
                  </div>
                  {open ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <StartCheckStage
                        stage={stage}
                        line={line}
                        rows={read.rows}
                        site={read.site}
                        notice={read.notice}
                        noticeKey={{ developmentId }}
                        today={todayYmd}
                        me={me}
                        kind={stageChecklistKindOf(stage.name)}
                        templates={read.templates}
                        can={can}
                        press={read.press}
                        io={read.io}
                        ask={doorFor(line.jobId)}
                        startOn={openOn}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
