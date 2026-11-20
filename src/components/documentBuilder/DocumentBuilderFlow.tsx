/**
 * The document builder's step-by-step flow (punch list #404, the flow of #389): a disclaimer with a box
 * to tick, the basis, a page on matching the paper to the site, one page a topic with its slider at
 * the bottom, and a review. The frame keeps one height, so the slider stays put while the page above
 * it changes under the thumb.
 *
 * The flow shows before it tells. The step bar is drawn in each topic's level, so the paper's shape is
 * on every page. A topic's page leads with what puts a person in breach, since that is what changes. A
 * line that stays glides to its new place and a new one eases in (`useGlide`). The review draws each
 * topic as a small track against the basis, and lists what the paper as it stands asks of the site.
 *
 * Every rule and every built sentence is `lib/documentBuilder/documentBuilder.ts`. The contents are the
 * `PaperDef` handed in. The state is held here in memory: nothing is read from or written to the
 * database, and the review's press requires nothing of anyone.
 *
 * No clause wording is drawn. A clause is grey bars, and the page marks the breach lines, the site
 * lines and the disclaimer as placeholders.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import {
  PAPER_OFF,
  basisNote,
  breachGroups,
  clauseDrawing,
  confirmWords,
  flowSteps,
  goToStep,
  isStepShut,
  levelFacts,
  nextLabel,
  nextStep,
  paperLevelLine,
  paperStops,
  prevStep,
  reviewLine,
  settleFlow,
  siteAsks,
  siteLines,
  siteNeeds,
  startFlow,
  startSettings,
  stepCountLine,
  stepStop,
  stopName,
  stopShortName,
  topicFloor,
  topicOf,
  topicSays,
  withAck,
  withBasis,
  withPaperOff,
  withTopic,
  type PaperDef,
  type PaperFlow as FlowState,
  type PaperSettings,
  type PaperStop,
  type PaperTopic,
} from '../../lib/documentBuilder/documentBuilder'
import { BuilderField, type BuilderFieldMark } from './BuilderField'
import { levelInk, levelTone } from './levelTone'
import { LevelBars, LevelChip, LevelTrack, DocumentBuilderSlider } from './DocumentBuilderSlider'

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MEAN: CSSProperties = { margin: 0, fontSize: '0.84rem', color: 'var(--text-700)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const GROUP_TITLE: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const BAR: CSSProperties = { display: 'block', height: 6, borderRadius: 3, background: 'var(--bg-200)' }
const TAG: CSSProperties = { borderRadius: 4, padding: '0 6px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }
const PICKED_TAG: CSSProperties = { ...TAG, background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' }
const FILLED_TAG: CSSProperties = { ...TAG, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
const SECOND_PRESS: CSSProperties = {
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  borderRadius: 9,
  padding: '8px 14px',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  fontWeight: 600,
  minHeight: 44,
  cursor: 'pointer',
}

function mainPress(dead: boolean): CSSProperties {
  return {
    border: 0,
    background: dead ? DEAD_PRESS_FILL : '#2563eb',
    color: dead ? DEAD_PRESS_TEXT : 'white',
    borderRadius: 9,
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    fontWeight: 700,
    minHeight: 44,
    minWidth: 0,
    cursor: dead ? 'not-allowed' : 'pointer',
  }
}

const LIST: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }

/**
 * One plain line behind a dot. `quiet` draws it in grey. `glide` names it for `useGlide`, so the same line keeps
 * its place in the page's memory when the level changes, slides to where it now sits, and eases in when it is new.
 */
function Line({ children, tone = 'var(--text-muted)', quiet = false, glide }: { children: ReactNode; tone?: string; quiet?: boolean; glide?: string }) {
  return (
    <li
      data-glide={glide}
      data-quiet={quiet ? '' : undefined}
      className={glide ? 'documentBuilderIn' : undefined}
      style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 9, alignItems: 'start', fontSize: '0.84rem', color: quiet ? 'var(--text-muted)' : 'var(--text-base)', transition: 'color 220ms' }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: quiet ? 'var(--border-strong)' : tone, marginTop: 7, transition: 'background-color 220ms' }} />
      <span>{children}</span>
    </li>
  )
}

/** A list of plain lines that never change place. */
function Lines({ children }: { children: string[] }) {
  return (
    <ul style={LIST}>
      {children.map((line) => (
        <Line key={line}>{line}</Line>
      ))}
    </ul>
  )
}

/**
 * Smooths a page that changes under the thumb. After each draw it reads where every `data-glide` element sits. One
 * that sat somewhere else a draw ago is shown there and let slide to its new place. A new one eases in by its own
 * class, and one that left is simply gone. A new `page` starts from nothing, so nothing slides between steps.
 *
 * The slide is a browser animation over the element's true place, never a style left on it: when a tab is hidden
 * and animations stand still, or the browser has none, every element is already where it belongs. Still when the
 * person asks for less motion.
 */
function useGlide(root: RefObject<HTMLElement | null>, page: string) {
  const seen = useRef<{ page: string; tops: Map<string, number>; running: Animation[] }>({ page: '', tops: new Map(), running: [] })
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    // A slide still running would be read as the element's place, so each one ends before the reading.
    for (const a of seen.current.running) a.cancel()
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-glide]'))
    const tops = new Map(nodes.map((n) => [n.dataset.glide ?? '', n.getBoundingClientRect().top + el.scrollTop]))
    const before = seen.current
    seen.current = { page, tops, running: [] }
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm || before.page !== page) return
    const moved = new Map<HTMLElement, number>()
    for (const n of nodes) {
      const was = before.tops.get(n.dataset.glide ?? '')
      const now = tops.get(n.dataset.glide ?? '')
      if (was != null && now != null && Math.abs(was - now) > 0.5) moved.set(n, was - now)
    }
    for (const [n, by] of moved) {
      // An element inside a moved element rides with it, so it slides only by what is left over.
      const outer = n.parentElement?.closest<HTMLElement>('[data-glide]')
      const own = by - (outer ? (moved.get(outer) ?? 0) : 0)
      if (Math.abs(own) > 0.5 && typeof n.animate === 'function') {
        seen.current.running.push(n.animate([{ transform: `translateY(${own}px)` }, { transform: 'none' }], { duration: 240, easing: 'ease' }))
      }
    }
  })
}

type Held = { settings: PaperSettings; flow: FlowState }

/**
 * Typing on the flow (step 7): every piece of words is a field, named by its path into the paper
 * (`lib/documentBuilder/paperEdit.ts`). The flow draws the fields and hands each change up. It keeps no words itself.
 */
export type FlowEdit = {
  /** `own` for words that differ from the published revision, else `usual`. */
  mark: (path: string) => BuilderFieldMark
  onWords: (path: string, words: string) => void
  onAddLine: (listPath: string) => void
  onRemoveLine: (listPath: string, index: number) => void
}

/** A page to show: its step, and for a topic the stop to stand on. A new `at` opens it again. */
export type FlowOpen = { step: string; stop?: PaperStop; at: number }

const CTL: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 6, padding: '0 8px', minHeight: 24, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', justifySelf: 'start' }

/** Words on the flow: a field while someone edits, the words alone when read. */
function W({ edit, path, text, label, tag, style }: { edit?: FlowEdit; path: string; text: string; label: string; tag?: 'span' | 'b' | 'div'; style?: CSSProperties }) {
  if (!edit) return <>{text}</>
  return <BuilderField editing text={text} mark={edit.mark(path)} label={label} tag={tag} style={style} onType={(words) => edit.onWords(path, words)} />
}

/** A list of lines while someone edits: each a field with its way off, and a press that adds one. Kept by place, so a line being typed is never drawn anew. */
function EditLines({ edit, listPath, lines, label, tone }: { edit: FlowEdit; listPath: string; lines: readonly string[]; label: string; tone?: string }) {
  return (
    <ul style={LIST}>
      {lines.map((line, i) => (
        <Line key={i} tone={tone}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'start', justifyContent: 'space-between' }}>
            <W edit={edit} path={`${listPath}.${i}`} text={line} label={`${label}, line ${i + 1}`} />
            <button type="button" aria-label={`Remove line ${i + 1} of ${label}`} onClick={() => edit.onRemoveLine(listPath, i)} style={CTL}>
              ×
            </button>
          </span>
        </Line>
      ))}
      <li>
        <button type="button" aria-label={`Add a line to ${label}`} onClick={() => edit.onAddLine(listPath)} style={CTL}>
          Add a line
        </button>
      </li>
    </ul>
  )
}

export function DocumentBuilderFlow({ def, style, edit, open }: { def: PaperDef; style?: CSSProperties; edit?: FlowEdit; open?: FlowOpen }) {
  const [held, setHeld] = useState<Held>(() => ({ settings: startSettings(def), flow: startFlow() }))
  const { settings, flow } = held
  const steps = flowSteps(def)
  const step = steps[flow.step] ?? steps[0]
  const last = steps.length - 1
  const body = useRef<HTMLDivElement>(null)

  // A new step starts at its top.
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [flow.step])

  useGlide(body, step?.key ?? '')

  // The map opens a page: its step, at its stop. The box on the first page is ticked for the person who edits.
  const openAt = open?.at
  useEffect(() => {
    if (!open) return
    setHeld((h) => {
      const i = flowSteps(def).findIndex((s) => s.key === open.step)
      if (i < 0) return h
      const acked = h.flow.ackAt ? h.flow : withAck(h.flow, true, new Date().toISOString())
      const on = h.settings.off ? withBasis(def, h.settings, h.settings.basis) : h.settings
      const s = open.stop != null && topicOf(def, open.step) ? withTopic(def, on, open.step, open.stop) : on
      return { settings: s, flow: settleFlow(def, s, { ...acked, step: i }) }
    })
    // Only a new press opens a page: the paper changes under it with every key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAt])

  if (!step) return null

  /** Change the settings, the flow or both. A step the change shut is left for one that is open. */
  const change = (next: Partial<Held>) =>
    setHeld((h) => {
      const s = next.settings ?? h.settings
      return { settings: s, flow: settleFlow(def, s, next.flow ?? h.flow) }
    })
  const go = (i: number) => change({ flow: goToStep(def, settings, flow, i) })
  const setTopic = (key: string, stop: PaperStop) => change({ settings: withTopic(def, settings, key, stop) })
  const pickBasis = (stop: PaperStop) => change({ settings: stop === PAPER_OFF ? withPaperOff(settings) : withBasis(def, settings, stop) })

  const topic = step.kind === 'topic' ? topicOf(def, step.key) : undefined
  const at = topic ? (settings.topics[topic.key] ?? settings.basis) : PAPER_OFF
  const confirm = confirmWords(def, settings, flow)
  const nextShut = isStepShut(def, settings, flow, nextStep(def, settings, flow))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        background: 'var(--bg-page)',
        color: 'var(--text-base)',
        overflow: 'hidden',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 14px 12px', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{stepCountLine(def, flow)}</div>
        <h2 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.25, fontWeight: 700, color: 'var(--text-strong)', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'center' }}>
          {topic && edit ? <W edit={edit} path={`topic.${topic.key}.label`} text={topic.label} label={`The name of ${topic.label}`} /> : step.name}
          {topic ? (
            <LevelChip def={def} stop={at}>
              {stopShortName(def, at)}
            </LevelChip>
          ) : null}
          {topic?.inEveryPaper ? <LevelChip def={def}>In every paper</LevelChip> : null}
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => {
            const shut = isStepShut(def, settings, flow, i)
            const now = i === flow.step
            // A topic's dash is its level's colour and the basis dash is the basis's, so the bar is the paper's shape.
            const stop = stepStop(settings, s)
            const fill = stop != null ? levelTone(def, stop) : i <= flow.step ? 'var(--text-muted)' : 'var(--bg-200)'
            return (
              <button
                key={s.key}
                type="button"
                disabled={shut}
                title={s.name}
                aria-label={`Step ${i + 1}: ${s.name}`}
                aria-current={now ? 'step' : undefined}
                onClick={() => go(i)}
                style={{ flex: '1 1 0', minWidth: 0, height: 24, border: 0, padding: 0, background: 'none', display: 'grid', alignItems: 'center', opacity: shut ? 0.4 : 1, cursor: shut ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ display: 'block', height: now ? 14 : 6, borderRadius: 999, background: fill, transition: 'height 160ms, background-color 220ms' }} />
              </button>
            )
          })}
        </div>
      </div>

      <div ref={body} style={{ flex: '1 1 auto', overflowY: 'auto', padding: 14, minHeight: 0 }}>
        <div key={step.key} className="documentBuilderIn" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          {step.kind === 'notice' ? <NoticePage def={def} edit={edit} /> : null}
          {step.kind === 'basis' ? <BasisPage def={def} settings={settings} onPick={pickBasis} edit={edit} /> : null}
          {step.kind === 'site' ? <SitePage def={def} settings={settings} edit={edit} /> : null}
          {topic ? <TopicPage def={def} topic={topic} settings={settings} edit={edit} /> : null}
          {step.kind === 'review' ? <ReviewPage def={def} settings={settings} flow={flow} edit={edit} onChange={(key) => go(steps.findIndex((s) => s.key === key))} /> : null}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 14px 12px', display: 'grid', gap: 8 }}>
        {step.kind === 'notice' ? (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-strong)', minHeight: 44, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={flow.ackAt != null}
              onChange={(e) => change({ flow: withAck(flow, e.target.checked, new Date().toISOString()) })}
              aria-label={edit ? def.notice.tick : undefined}
              style={{ width: 20, height: 20, margin: 0, accentColor: '#2563eb' }}
            />
            {edit ? null : <span>{def.notice.tick}</span>}
          </label>
        ) : null}
        {step.kind === 'notice' && edit ? (
          <p style={{ ...MEAN, fontWeight: 600 }}>
            <W edit={edit} path="notice.tick" text={def.notice.tick} label="The words beside the box" />
          </p>
        ) : null}
        {step.kind === 'basis' ? (
          <>
            <LevelFacts def={def} level={settings.off ? PAPER_OFF : settings.basis} />
            <DocumentBuilderSlider def={def} value={settings.off ? PAPER_OFF : settings.basis} label={step.name} onPick={pickBasis} />
          </>
        ) : null}
        {topic ? (
          <DocumentBuilderSlider
            key={topic.key}
            def={def}
            value={at}
            label={topic.label}
            floor={topicFloor(topic)}
            floorWhy="This topic is in every paper"
            basis={settings.basis}
            onPick={(stop) => setTopic(topic.key, stop)}
          />
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: flow.step > 0 ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 8 }}>
          {flow.step > 0 ? (
            <button type="button" style={SECOND_PRESS} onClick={() => go(prevStep(def, settings, flow))}>
              Back
            </button>
          ) : null}
          {flow.step < last ? (
            <button type="button" disabled={nextShut} style={mainPress(nextShut)} onClick={() => go(nextStep(def, settings, flow))}>
              {nextLabel(def, settings, flow)}
            </button>
          ) : (
            <button type="button" disabled={confirm.dead} style={mainPress(confirm.dead)} onClick={() => change({ flow: { ...flow, done: true } })}>
              {confirm.label}
            </button>
          )}
        </div>
        {step.kind === 'notice' && flow.ackAt == null ? <p style={MUTED}>Tick the box to go on.</p> : null}
        {flow.step === last ? <p style={MUTED}>{confirm.note}</p> : null}
      </div>
    </div>
  )
}

/** Step 1: the disclaimer. Its lines are the data's, and the page says they are placeholders. */
function NoticePage({ def, edit }: { def: PaperDef; edit?: FlowEdit }) {
  return (
    <div style={CARD}>
      <h3 style={CARD_TITLE}>
        <W edit={edit} path="notice.title" text={def.notice.title} label="The disclaimer's title" />
      </h3>
      {edit ? <EditLines edit={edit} listPath="notice.lines" lines={def.notice.lines} label="the disclaimer" /> : <Lines>{def.notice.lines}</Lines>}
      <p style={FINE}>
        <W edit={edit} path="notice.placeholder" text={def.notice.placeholder} label="The disclaimer's note" />
      </p>
    </div>
  )
}

/**
 * Step 2: the level the paper should express. Each level is a press, and the slider below sets the same thing. What
 * the picked level does is drawn above the slider (`LevelFacts`), where it stays in view on a phone.
 */
function BasisPage({ def, settings, onPick, edit }: { def: PaperDef; settings: PaperSettings; onPick: (stop: PaperStop) => void; edit?: FlowEdit }) {
  // The picked level is kept in view as the slider moves it down the list, which matters on a phone.
  const picked = useRef<HTMLButtonElement>(null)
  const pickedId = settings.off ? null : settings.basis
  useEffect(() => {
    if (typeof picked.current?.scrollIntoView === 'function') picked.current.scrollIntoView({ block: 'nearest' })
  }, [pickedId])
  return (
    <>
      <p style={MEAN}>
        <W edit={edit} path="words.basisAsk" text={def.words.basisAsk} label="What the basis page asks" />
      </p>
      <div style={CARD}>
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ ...GROUP_TITLE, padding: '0 8px 2px' }}>
            <W edit={edit} path="words.levelsTitle" text={def.words.levelsTitle} label="The title over the levels" />
          </div>
          {def.levels.map((level) => {
            const on = !settings.off && settings.basis === level.id
            return (
              <button
                key={level.id}
                type="button"
                ref={on ? picked : undefined}
                aria-pressed={on}
                onClick={() => onPick(level.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  gap: '2px 10px',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: `1px solid ${on ? 'var(--border)' : 'transparent'}`,
                  background: on ? 'var(--bg-muted)' : 'none',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '0.84rem',
                  minHeight: 44,
                  cursor: 'pointer',
                  transition: 'background-color 180ms, border-color 180ms',
                }}
              >
                <LevelBars def={def} stop={level.id} />
                <span>
                  <b style={{ display: 'block', color: 'var(--text-strong)' }}>{level.name}</b>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{level.alignedWith}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p style={MUTED}>{basisNote(def, settings)}</p>
      <p style={FINE}>
        <W edit={edit} path="words.basisHow" text={def.words.basisHow} label="How the basis works" />
        {' The numbers above the slider are placeholders.'}
      </p>
    </>
  )
}

/**
 * What a level does, as a gauge above the dial: the same few facts on every level, each in its own place, so the
 * numbers change where the thumb is as the basis slides. Nothing is drawn while the whole paper is Off.
 */
function LevelFacts({ def, level }: { def: PaperDef; level: PaperStop }) {
  const facts = levelFacts(def, level)
  if (facts.length === 0) return null
  return (
    <div data-level-facts="" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '6px 10px' }}>
      {facts.map((fact) => (
        <div key={fact.key} style={{ display: 'grid', gap: 1, alignContent: 'start' }}>
          <span style={{ ...GROUP_TITLE, fontSize: '0.62rem' }}>{fact.label}</span>
          {/* Named by its value, so a number that changes eases in and one that stays holds still. */}
          <b key={fact.value} className="documentBuilderIn" style={{ fontSize: '0.95rem', lineHeight: 1.2, color: levelInk(def, level) }}>
            {fact.value}
          </b>
        </div>
      ))}
    </div>
  )
}

/** Step 3: the paper has to match what the site can really enforce, with what the basis asks of it. */
function SitePage({ def, settings, edit }: { def: PaperDef; settings: PaperSettings; edit?: FlowEdit }) {
  const asks = siteAsks(def, settings.basis)
  return (
    <>
      <p style={MEAN}>
        <W edit={edit} path="site.lead" text={def.site.lead} label="The site page's lead" />
      </p>
      <div style={CARD}>
        <h3 style={CARD_TITLE}>
          <W edit={edit} path="site.title" text={def.site.title} label="The site page's title" />
        </h3>
        {edit ? <EditLines edit={edit} listPath="site.lines" lines={def.site.lines} label="the site page" /> : <Lines>{def.site.lines}</Lines>}
      </div>
      <div style={CARD}>
        <h3 style={CARD_TITLE}>{`What ${stopName(def, settings.basis)} asks of this site`}</h3>
        {asks.length > 0 ? (
          <div>
            {asks.map((row, i) => (
              <div key={row.key} style={{ padding: '7px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)', fontSize: '0.84rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{row.label}</div>
                <div style={MUTED}>{row.lines.join(' ')}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={MUTED}>
            <W edit={edit} path="site.asksNothing" text={def.site.asksNothing} label="What the site page says when nothing is asked" />
          </p>
        )}
        <p style={FINE}>
          <W edit={edit} path="site.placeholder" text={def.site.placeholder} label="The site page's note" />
        </p>
      </div>
    </>
  )
}

/**
 * Steps 4 to 10: one topic. What puts a person in breach leads, since it is what changes as the handle moves. What
 * the site must have is next. The core clause is one thin strip of grey bars at the foot: it says the least.
 */
function TopicPage({ def, topic, settings, edit }: { def: PaperDef; topic: PaperTopic; settings: PaperSettings; edit?: FlowEdit }) {
  const at = settings.topics[topic.key] ?? settings.basis
  const clause = clauseDrawing(def, topic.key, at)
  const breach = breachGroups(def, topic.key, at)
  const site = siteLines(def, topic.key, at)
  const tone = levelTone(def, at)
  const here = `topic.${topic.key}.${at}`
  const levelLines = at === PAPER_OFF ? [] : (topic.levels[at]?.breach ?? [])
  const where = `${topic.label} at ${stopShortName(def, at)}`
  return (
    <>
      {edit ? (
        // One field while someone edits: the words of the stop the page stands on.
        <p style={MEAN}>
          <W edit={edit} path={at === PAPER_OFF ? `topic.${topic.key}.offSays` : `${here}.says`} text={topicSays(def, topic.key, at)} label={`What ${where} means`} />
        </p>
      ) : (
      /* Every stop's meaning is laid in the one cell and only the current one is seen. The cell is then as tall
         as the longest of them, so the cards under it hold still while the words change. */
      <div style={{ display: 'grid' }}>
        {paperStops(def)
          .slice(topicFloor(topic))
          .map((stop) => (
            <p key={stop} aria-hidden={stop === at ? undefined : true} style={{ ...MEAN, gridArea: '1 / 1', opacity: stop === at ? 1 : 0, transition: 'opacity 180ms', pointerEvents: stop === at ? undefined : 'none' }}>
              {topicSays(def, topic.key, stop)}
            </p>
          ))}
      </div>
      )}

      <div style={CARD}>
        <h3 style={CARD_TITLE}>What puts a person in breach</h3>
        {at === PAPER_OFF ? (
          <p style={MUTED}>Nothing on this topic. This paper sets no rule here.</p>
        ) : (
          // One list, each line named by its words: a line the next level keeps stays the same element, so it
          // slides down into grey under *Also applies* while the level's new lines ease in above it.
          <ul style={LIST}>
            {breach.newAt ? (
              <li key="::new" data-glide="breach-new" className="documentBuilderIn">
                <LevelChip def={def} stop={at}>
                  {breach.own.length > 0 ? `New at ${breach.newAt}` : `Nothing new at ${breach.newAt}`}
                </LevelChip>
              </li>
            ) : null}
            {breach.own.map((line) =>
              edit ? (
                // Kept by its place in the level's own list, so the line being typed is never drawn anew.
                <Line key={`own-${levelLines.indexOf(line)}`} tone={tone}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'start', justifyContent: 'space-between' }}>
                    <W edit={edit} path={`${here}.breach.${levelLines.indexOf(line)}`} text={line} label={`A breach line of ${where}`} />
                    <button type="button" aria-label={`Remove the breach line: ${line}`} onClick={() => edit.onRemoveLine(`${here}.breach`, levelLines.indexOf(line))} style={CTL}>
                      ×
                    </button>
                  </span>
                </Line>
              ) : (
                <Line key={line} glide={`breach:${line}`} tone={tone}>
                  {line}
                </Line>
              ),
            )}
            {edit ? (
              <li key="::add">
                <button type="button" aria-label={`Add a breach line to ${where}`} onClick={() => edit.onAddLine(`${here}.breach`)} style={CTL}>
                  Add a line
                </button>
              </li>
            ) : null}
            {breach.carried.length > 0 ? (
              <li key="::also" data-glide="breach-also" className="documentBuilderIn" style={{ ...GROUP_TITLE, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                Also applies
              </li>
            ) : null}
            {breach.carried.map((line) => (
              <Line key={line} glide={`breach:${line}`} quiet>
                {line}
              </Line>
            ))}
          </ul>
        )}
      </div>

      {site.length > 0 || (edit && at !== PAPER_OFF) ? (
        <div style={CARD} data-glide="site" className="documentBuilderIn">
          <h3 style={CARD_TITLE}>What the site must have</h3>
          {edit ? (
            <EditLines edit={edit} listPath={`${here}.site`} lines={site} label={`what the site must have for ${where}`} />
          ) : (
            <ul style={LIST}>
              {site.map((line) => (
                <Line key={line} glide={`site:${line}`}>
                  {line}
                </Line>
              ))}
            </ul>
          )}
          <p style={FINE}>If this site does not have these, pick a lower level on this page.</p>
        </div>
      ) : null}

      <div style={{ ...CARD, padding: '10px 14px', gap: 6 }} data-glide="clause">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'center' }}>
          <span style={GROUP_TITLE}>The core clause</span>
          {clause.kind === 'out' ? null : (
            <>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)' }}>{topic.section}</span>
              <span style={clause.kind === 'blank' ? FILLED_TAG : PICKED_TAG}>{clause.tag}</span>
            </>
          )}
        </div>
        {clause.kind === 'out' ? (
          <p style={MUTED}>{`${topic.section} is left out of the paper.`}</p>
        ) : (
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }}>
            {clause.kind === 'blank' ? (
              <>
                <span style={{ ...BAR, flex: '30 1 0' }} />
                <span style={FILLED_TAG}>
                  <W edit={edit} path={`${here}.blank`} text={clause.blank} label={`What fills the blank for ${where}`} />
                </span>
                <span style={{ ...BAR, flex: '70 1 0' }} />
              </>
            ) : (
              clause.bars.map((width, i) => <span key={i} className="documentBuilderIn" style={{ ...BAR, flex: `${width} 1 0` }} />)
            )}
          </div>
        )}
      </div>

      <p style={FINE} data-glide="fine">
        Placeholder words. An attorney sets the wording, what a breach is and what the site needs. The clause is drawn as grey bars.
      </p>
    </>
  )
}

/**
 * Step 11: the paper's shape. Each topic is a small track with its dot against the basis, and the row opens its
 * page. Under them, what the paper as it stands asks of the site, which is the list to hold against the real site.
 */
function ReviewPage({ def, settings, flow, onChange, edit }: { def: PaperDef; settings: PaperSettings; flow: FlowState; onChange: (key: string) => void; edit?: FlowEdit }) {
  if (settings.off) {
    return (
      <div style={{ ...CARD, fontSize: '0.84rem' }}>
        <W edit={edit} path="words.offReview" text={def.words.offReview} label="What the review says when the paper is Off" />
      </div>
    )
  }
  const needs = siteNeeds(def, settings)
  const strictest = def.levels[def.levels.length - 1]
  const TRACK = 96
  return (
    <>
      <div style={CARD}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', alignItems: 'center' }}>
          <h3 style={CARD_TITLE}>
            <W edit={edit} path="words.reviewTitle" text={def.words.reviewTitle} label="The review's title" />
          </h3>
          <LevelChip def={def} stop={settings.basis} wrap>
            {paperLevelLine(def, settings)}
          </LevelChip>
        </div>
        <p style={MEAN}>{reviewLine(def, settings)}</p>
        <div>
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 18 }}>
            <span style={{ ...GROUP_TITLE, fontSize: '0.62rem', width: TRACK, display: 'flex', justifyContent: 'space-between' }}>
              <span>Off</span>
              <span>{strictest ? stopShortName(def, strictest.id) : ''}</span>
            </span>
          </div>
          {def.topics.map((t) => {
            const at = settings.topics[t.key] ?? settings.basis
            return (
              <button
                key={t.key}
                type="button"
                aria-label={`Change ${t.label}`}
                onClick={() => onChange(t.key)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  gap: '2px 8px',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 0',
                  border: 0,
                  borderTop: '1px solid var(--border)',
                  background: 'none',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)' }}>{t.label}</span>
                  <span style={{ ...MUTED, display: 'block' }}>{topicSays(def, t.key, at)}</span>
                </span>
                <span style={{ display: 'grid', justifyItems: 'center', gap: 1 }}>
                  <LevelTrack def={def} stop={at} basis={settings.basis} width={TRACK} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: levelInk(def, at) }}>{stopShortName(def, at)}</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1 }}>
                  ›
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={CARD}>
        <h3 style={CARD_TITLE}>What this site must have</h3>
        {needs.length > 0 ? (
          <>
            <div>
              {needs.map((row, i) => (
                <div key={row.key} style={{ padding: '7px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)', fontSize: '0.84rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{row.label}</div>
                  <div style={MUTED}>{row.lines.join(' ')}</div>
                </div>
              ))}
            </div>
            <p style={FINE}>If this site lacks one of these, open that topic above and pick a lower level.</p>
          </>
        ) : (
          <p style={MUTED}>{def.site.asksNothing}</p>
        )}
      </div>

      <p style={FINE}>
        Placeholder words, for an attorney to set.
        {flow.ackAt ? ` You ticked the disclaimer on ${formatCompactNoteDateTime(flow.ackAt)}.` : ''}
      </p>
    </>
  )
}
