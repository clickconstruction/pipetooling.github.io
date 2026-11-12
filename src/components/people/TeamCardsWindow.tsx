/**
 * Cards and footers (punch list #313) — the whole team at once, opened by the office.
 *
 * People → Users, *Cards and footers*. It lists everyone with whether a card can be made for
 * them. *Make N cards* gives one print file with every ready person's front and back.
 * *Download N footers* gives one picture each, named for its person. A person with no photo is
 * held and named with a door that opens their card; the rest are still made (`teamPressWords`,
 * `CLAUDE.md` → Do what is ready). A person whose photo will not load fails by name and the
 * batch keeps going.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { DESK_EDITOR_Z } from '../personDesk/personDeskShared'
import { useToastContext } from '../../contexts/ToastContext'
import { batchOutcomeWords } from '../../lib/batchWords'
import { supabaseTeamCardIo, type TeamCardIo } from '../../lib/brandKit/cardIo'
import { drawKit, printPage, type KitDrawOptions } from '../../lib/brandKit/draw'
import { DEFAULT_CARD_LOOKS, lookLayouts, resolveLook, type CardLooksSetting } from '../../lib/brandKit/looks'
import { kitFileSlug } from '../../lib/brandKit/person'
import { DEFAULT_CARD_SIZES, cardBackFor, resolveSize, type CardSizesSetting } from '../../lib/brandKit/sizes'
import { browserKitRenderer, type KitRenderer } from '../../lib/brandKit/render'
import { defaultTicks, teamCards, teamPressWords, type TeamCard } from '../../lib/brandKit/team'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { saveBlobAs } from '../../lib/storageSave'
import { formatErrorMessage } from '../../utils/errorHandling'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }
const quiet: CSSProperties = { padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontWeight: 500 }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-700)', whiteSpace: 'nowrap' }
const ready: CSSProperties = { ...chip, color: 'var(--text-green-700)', borderColor: 'var(--text-green-700)', background: 'var(--bg-green-100)' }
const heldChip: CSSProperties = { ...chip, color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-700)', background: 'var(--bg-amber-100)' }
const door: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', font: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }

function press(on: boolean, primary: boolean): CSSProperties {
  if (!on) return { ...quiet, border: 'none', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
  return primary ? { ...quiet, border: 'none', background: '#2563eb', color: 'white' } : quiet
}

type Failed = { name: string; why: string }

export function TeamCardsWindow({
  io: ioProp,
  renderer: rendererProp,
  reloadKey = 0,
  onClose,
  onOpenCard,
}: {
  io?: TeamCardIo
  renderer?: KitRenderer
  /** Bumped by the page when a teammate's card was closed, so a photo added there shows here. */
  reloadKey?: number
  onClose: () => void
  onOpenCard: (row: { userId: string; name: string }) => void
}) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseTeamCardIo(), [ioProp])
  const renderer = useMemo(() => rendererProp ?? browserKitRenderer(), [rendererProp])
  // undefined while reading, null when the read failed
  const [cards, setCards] = useState<TeamCard[] | null | undefined>(undefined)
  const [setting, setSetting] = useState<CardLooksSetting>(DEFAULT_CARD_LOOKS)
  const [sizes, setSizes] = useState<CardSizesSetting>(DEFAULT_CARD_SIZES)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [making, setMaking] = useState<'cards' | 'footers' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ head: string; rows: Failed[] } | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => void (live.current = false)
  }, [])

  useEffect(() => {
    let on = true
    setProblem(null)
    void (async () => {
      try {
        const [team, looks, offeredSizes] = await Promise.all([io.team(), io.looks(), io.sizes()])
        const rows = teamCards(team, PORTAL_COMPANY.phone)
        if (!on) return
        setSetting(looks)
        setSizes(offeredSizes)
        setCards(rows)
        setTicked(defaultTicks(rows))
      } catch (e) {
        if (!on) return
        setCards(null)
        setProblem(formatErrorMessage(e, 'The team could not be read.'))
      }
    })()
    return () => {
      on = false
    }
  }, [io, reloadKey])

  const words = useMemo(() => teamPressWords(cards ?? [], ticked), [cards, ticked])
  const canMake = !making && words.ready.length > 0

  /** Each ready person with their photo fetched and their drawings made; a person whose photo will not load fails by name. */
  const gather = async (kit: Required<Pick<KitDrawOptions, 'assets' | 'measure'>>) => {
    // each person in the look and the card size they picked, or the company's defaults
    const done: { card: TeamCard; footer: string; front: string; back: string; footerSize: [number, number] }[] = []
    const failures: Failed[] = []
    for (const c of words.ready) {
      try {
        const photo = await io.photo(c.photoPath ?? '')
        const person = { ...c.person, photo: { ...photo, ...c.crop } }
        const lookId = resolveLook(c.look, setting)
        const look = lookLayouts(lookId)
        done.push({
          card: c,
          footer: drawKit(look.footer, person, { ...kit, id: `team-f-${c.id}` }),
          front: drawKit(look.front, null, kit),
          back: drawKit(cardBackFor(lookId, resolveSize(c.size, sizes)), person, { ...kit, id: `team-b-${c.id}` }),
          footerSize: look.footer.size,
        })
      } catch (e) {
        failures.push({ name: c.name, why: formatErrorMessage(e, 'The photo could not be read.') })
      }
    }
    return { done, failures }
  }

  const run = async (what: 'cards' | 'footers') => {
    if (!canMake) return
    setMaking(what)
    setProblem(null)
    setFailed(null)
    try {
      const kit = await renderer.ready()
      const { done, failures } = await gather(kit)
      if (what === 'cards' && done.length) {
        const pages = done.flatMap((d) => [printPage(d.front), printPage(d.back)]).map((svg) => ({ svg, widthIn: 4.25, heightIn: 2.75, dpi: 600 }))
        saveBlobAs(await renderer.pdf(pages), 'cards-team.pdf')
      }
      if (what === 'footers') {
        for (const d of done) {
          saveBlobAs(await renderer.png(d.footer, d.footerSize[0], d.footerSize[1]), `footer-${kitFileSlug(d.card.name)}.png`)
          // a browser asks before it saves many files at once; a beat between them keeps each one
          await new Promise((r) => window.setTimeout(r, 350))
        }
      }
      if (!live.current) return
      const outcome = batchOutcomeWords({ verb: 'come out', past: 'Made', done: done.length, failed: failures.length, noun: what === 'cards' ? 'card' : 'footer' })
      showToast(outcome.line, outcome.tone)
      setFailed(outcome.head ? { head: outcome.head, rows: failures } : null)
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e, 'They could not be made.'))
    } finally {
      if (live.current) setMaking(null)
    }
  }

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ResponsiveModalShell title="Cards and footers for the team" onRequestClose={onClose} maxWidthDesktop={760} zIndex={DESK_EDITOR_Z} fullScreenKey="team-cards">
      <div data-team-cards-window>
        <p style={{ ...muted, marginBottom: '0.75rem' }}>Tick who to make them for. Everyone with a photo starts ticked.</p>
        {/* the presses sit above the list, so a long team never pushes them off the screen */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <button type="button" onClick={() => void run('cards')} disabled={!canMake} style={press(canMake, true)}>
            {making === 'cards' ? 'Making them…' : words.cards.button}
          </button>
          <button type="button" onClick={() => void run('footers')} disabled={!canMake} style={press(canMake, false)}>
            {making === 'footers' ? 'Making them…' : words.footers}
          </button>
        </div>
        {words.cards.foot ? <p style={{ ...muted, marginBottom: '0.6rem' }}>{words.cards.foot}</p> : null}
        {cards === undefined ? <p style={muted}>Reading the team…</p> : null}
        {cards ? (
          <div role="list" style={{ borderTop: '1px solid var(--border)' }}>
            {cards.map((c) => (
              <div key={c.id} role="listitem" data-team-card-row={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <input type="checkbox" aria-label={c.name} checked={!c.hold && ticked.has(c.id)} disabled={Boolean(c.hold) || Boolean(making)} onChange={() => toggle(c.id)} />
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {c.person.title ? <div style={muted}>{c.person.title}</div> : null}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {c.hold ? <span style={heldChip}>{c.hold}</span> : <span style={ready}>Ready</span>}
                  {c.leftOff.map((line) => (
                    <span key={line} style={chip}>
                      {line}
                    </span>
                  ))}
                </div>
                <button type="button" style={door} onClick={() => onOpenCard({ userId: c.id, name: c.name })}>
                  {c.hold === 'No photo' ? 'Add a photo ▸' : 'Open the card ▸'}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {failed ? (
          <div role="alert" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>{failed.head}</div>
            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-700)' }}>
              {failed.rows.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.why}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {problem ? (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.6rem' }}>
            {problem}
          </div>
        ) : null}

        <p style={{ ...muted, marginTop: '0.4rem' }}>The cards come as one print file, a front and a back for each person. The footers come as one picture each, named for its person.</p>
      </div>
    </ResponsiveModalShell>
  )
}
