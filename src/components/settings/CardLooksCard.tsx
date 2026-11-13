/**
 * Cards and footers (punch list #313) — the owner's card, *Card and footer looks*.
 *
 * A look is the card and the footer in other colours over the same layouts (`lib/brandKit/looks.ts`).
 * A developer draws one; nobody on the team is offered it until the owner switches it on here.
 * One look is the default, for everyone who has not picked. Switching a look off moves the people
 * on it to the default: their next footer and card are drawn in the default.
 *
 * Under the looks sit the card sizes (`lib/brandKit/sizes.ts`): the standard card, one with a
 * larger photo and one with larger words. They are offered the same way, by a switch and a
 * default, and kept in a setting of their own so that saving one never rewrites the other.
 *
 * Each setting is one row of `app_settings`, which any signed-in person reads and the owner or a
 * dev writes (`20261113130000_card_looks_keys_owner.sql`), so the card shows for those two
 * (`approvesCardLooks`, v2.7139; a dev alone before, which kept the owner from his own card).
 * Each look and each size is drawn with the viewer's own facts, so the owner judges it on a real
 * card. A save the database refuses puts the switch back and says its reason.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { supabaseCardIo, supabaseLooksAdminIo, type CardIo, type LooksAdminIo } from '../../lib/brandKit/cardIo'
import { approvesCardLooks } from '../../lib/brandKit/access'
import { LOOKS_WORDS as W, lookUseWords } from '../../lib/brandKit/cardWords'
import { drawKit, type KitDrawOptions, type KitPerson } from '../../lib/brandKit/draw'
import { LOOK_IDS, THEMES, lookCounts, lookLayouts, withDefaultLook, withLookSwitched, type CardLooksSetting, type KitLookId } from '../../lib/brandKit/looks'
import { kitPersonFromUser } from '../../lib/brandKit/person'
import { browserKitRenderer, type KitRenderer } from '../../lib/brandKit/render'
import { SIZES, SIZE_IDS, cardBackFor, sizeCounts, withDefaultSize, withSizeSwitched, type CardSizesSetting, type KitSizeId } from '../../lib/brandKit/sizes'
import { formatErrorMessage } from '../../utils/errorHandling'

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-700)', whiteSpace: 'nowrap' }
/** The art keeps its own colours in both themes. */
const art: CSSProperties = { borderRadius: 6, overflow: 'hidden', lineHeight: 0, background: 'black' }

export function CardLooksCard({
  role,
  io: ioProp,
  cardIo: cardIoProp,
  renderer: rendererProp,
}: {
  role: UserRole | null | undefined
  io?: LooksAdminIo
  cardIo?: Pick<CardIo, 'load' | 'photo'>
  renderer?: KitRenderer
}) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const io = useMemo(() => ioProp ?? supabaseLooksAdminIo(), [ioProp])
  const cardIo = useMemo(() => cardIoProp ?? supabaseCardIo(), [cardIoProp])
  const renderer = useMemo(() => rendererProp ?? browserKitRenderer(), [rendererProp])
  const clipId = `looks${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const canApprove = approvesCardLooks(role)

  // undefined while reading, null when the read failed
  const [setting, setSetting] = useState<CardLooksSetting | null | undefined>(undefined)
  const [sizes, setSizes] = useState<CardSizesSetting | null>(null)
  const [picks, setPicks] = useState<{ look: string | null; size: string | null }[]>([])
  const [person, setPerson] = useState<KitPerson | null>(null)
  const [kit, setKit] = useState<Required<Pick<KitDrawOptions, 'assets' | 'measure'>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => void (live.current = false)
  }, [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (!canApprove) return
    let on = true
    setProblem(null)
    void (async () => {
      try {
        const [looks, everyone, offeredSizes] = await Promise.all([io.looks(), io.picks(), io.sizes()])
        if (!on) return
        setSetting(looks)
        setSizes(offeredSizes)
        setPicks(everyone)
      } catch (e) {
        if (!on) return
        setSetting(null)
        setProblem(formatErrorMessage(e, W.notRead))
      }
      // the previews are a courtesy: the switches work without them
      try {
        const ready = await renderer.ready()
        const mine = userId ? await cardIo.load(userId) : null
        const pic = mine?.photoPath ? await cardIo.photo(mine.photoPath).catch(() => null) : null
        if (!on) return
        setKit(ready)
        setPerson(mine ? kitPersonFromUser(mine.facts, PORTAL_COMPANY.phone, pic ? { ...pic, ...mine.crop } : null) : null)
      } catch {
        // no previews
      }
    })()
    return () => {
      on = false
    }
  }, [canApprove, io, cardIo, renderer, userId])

  const previews = useMemo(() => {
    if (!kit || !person) return null
    return Object.fromEntries(LOOK_IDS.map((id) => [id, drawKit(lookLayouts(id).footer, person, { assets: kit.assets, measure: kit.measure, width: '100%', id: `${clipId}${id.replace(/[^a-z]/g, '')}` })])) as Record<KitLookId, string>
  }, [kit, person, clipId])

  /** The card's back in each size, in the default look, so the owner sees what a size changes. */
  const defaultLook = setting?.default ?? 'classic'
  const sizePreviews = useMemo(() => {
    if (!kit || !person) return null
    return Object.fromEntries(SIZE_IDS.map((id) => [id, drawKit(cardBackFor(defaultLook, id), person, { assets: kit.assets, measure: kit.measure, width: '100%', id: `${clipId}size${id}` })])) as Record<KitSizeId, string>
  }, [kit, person, clipId, defaultLook])

  if (!canApprove) return null

  const counts = setting ? lookCounts(picks.map((p) => p.look), setting) : null
  const sizeUse = sizes ? sizeCounts(picks.map((p) => p.size), sizes) : null

  const saveSizes = async (next: CardSizesSetting) => {
    if (!sizes || busy || next === sizes) return
    const before = sizes
    setSizes(next)
    setBusy(true)
    setProblem(null)
    try {
      await io.saveSizes(next)
      if (live.current) showToast(W.sizesSaved, 'success')
    } catch (e) {
      if (!live.current) return
      setSizes(before)
      setProblem(formatErrorMessage(e, W.sizesNotSaved))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  const save = async (next: CardLooksSetting) => {
    if (!setting || busy || next === setting) return
    const before = setting
    setSetting(next)
    setBusy(true)
    setProblem(null)
    try {
      await io.saveLooks(next)
      if (live.current) showToast(W.saved, 'success')
    } catch (e) {
      if (!live.current) return
      setSetting(before)
      setProblem(formatErrorMessage(e, W.notSaved))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  return (
    <div id="settings-card-looks" data-card-looks style={card}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>{W.title}</h2>
      <p style={{ ...muted, marginBottom: '0.6rem' }}>{W.lead}</p>
      {setting === undefined ? <p style={muted}>{W.loading}</p> : null}
      {setting
        ? LOOK_IDS.map((id) => {
            const on = setting.approved.includes(id)
            const isDefault = setting.default === id
            return (
              <div key={id} data-card-look={id} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px', maxWidth: '100%' }}>
                  {previews ? (
                    // The string is drawKit's own: it escapes every fact, and the pictures in it are data.
                    // eslint-disable-next-line react/no-danger
                    <div style={art} dangerouslySetInnerHTML={{ __html: previews[id] }} />
                  ) : (
                    <div style={{ ...art, height: 50, background: THEMES[id].ground, borderBottom: `6px solid ${THEMES[id].accent}` }} />
                  )}
                </div>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {THEMES[id].name} {on ? null : <span style={chip}>{W.notOffered}</span>}
                  </div>
                  <p style={muted}>
                    {THEMES[id].says} {on && counts ? lookUseWords(counts[id]) : null}
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
                  <input type="radio" name={`${clipId}-default`} checked={isDefault} disabled={busy} onChange={() => void save(withDefaultLook(setting, id))} />
                  {W.defaultLabel}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }} title={isDefault ? W.defaultStays : undefined}>
                  <input type="checkbox" role="switch" aria-label={`${W.offered}: ${THEMES[id].name}`} checked={on} disabled={busy || isDefault} onChange={(e) => void save(withLookSwitched(setting, id, e.target.checked))} />
                  {W.offered}
                </label>
              </div>
            )
          })
        : null}
      {setting ? <p style={{ ...muted, marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>{W.foot}</p> : null}

      {setting && sizes ? (
        <div data-card-sizes>
          <h3 style={{ margin: '1.1rem 0 0.4rem', fontSize: '0.9375rem', fontWeight: 600 }}>{W.sizesTitle}</h3>
          <p style={{ ...muted, marginBottom: '0.6rem' }}>{W.sizesLead}</p>
          {SIZE_IDS.map((id) => {
            const on = sizes.approved.includes(id)
            const isDefault = sizes.default === id
            return (
              <div key={id} data-card-size={id} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px', maxWidth: '100%' }}>
                  {sizePreviews ? (
                    // eslint-disable-next-line react/no-danger
                    <div style={art} dangerouslySetInnerHTML={{ __html: sizePreviews[id] }} />
                  ) : (
                    <div style={{ ...art, height: 50, background: THEMES[defaultLook].cardGround, borderBottom: `6px solid ${THEMES[defaultLook].accent}` }} />
                  )}
                </div>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {SIZES[id].name} {on ? null : <span style={chip}>{W.notOffered}</span>}
                  </div>
                  <p style={muted}>
                    {SIZES[id].says} {on && sizeUse ? lookUseWords(sizeUse[id]) : null}
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
                  <input type="radio" name={`${clipId}-default-size`} checked={isDefault} disabled={busy} onChange={() => void saveSizes(withDefaultSize(sizes, id))} />
                  {W.defaultLabel}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }} title={isDefault ? W.defaultStays : undefined}>
                  <input type="checkbox" role="switch" aria-label={`${W.offered}: ${SIZES[id].name}`} checked={on} disabled={busy || isDefault} onChange={(e) => void saveSizes(withSizeSwitched(sizes, id, e.target.checked))} />
                  {W.offered}
                </label>
              </div>
            )
          })}
          <p style={{ ...muted, marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>{W.sizesFoot}</p>
        </div>
      ) : null}
      {problem ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.6rem' }}>
          {problem}
        </div>
      ) : null}
    </div>
  )
}
