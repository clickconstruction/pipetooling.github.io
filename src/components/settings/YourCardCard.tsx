/**
 * Cards and footers (punch list #313) — the card *Your card and footer* on Settings → Your account.
 *
 * A person's email footer and business card, drawn from their own facts and photo instead of a
 * picture a designer made by hand. The photo and the facts are on the left; what they make is on
 * the right, with the presses under each: the footer as a picture to upload as a mail signature,
 * the card as a print file for a print shop and as a sheet of ten for the office printer.
 *
 * The drawing is `drawKit` over the look the owner chose (`src/lib/brandKit/`). The previews on
 * the page and the files a press makes are the same drawing. With `userId` and `teammate` the
 * office opens the same card for someone else (People → Users).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { supabaseCardIo, type CardIo, type CardLoad, type CardPhoto } from '../../lib/brandKit/cardIo'
import { CARD_NAME_MAX, cardWordsFor } from '../../lib/brandKit/cardWords'
import { stagePlacement } from '../../lib/brandKit/cropMath'
import { drawKit, printPage, sheetOfTen, type KitDrawOptions } from '../../lib/brandKit/draw'
import { DEFAULT_CARD_LOOKS, THEMES, lookLayouts, resolveLook, type CardLooksSetting, type KitLookId } from '../../lib/brandKit/looks'
import { cardHold, kitFileSlug, kitPersonFromUser, type KitCrop } from '../../lib/brandKit/person'
import { browserKitRenderer, type KitRenderer } from '../../lib/brandKit/render'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { saveBlobAs } from '../../lib/storageSave'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PhotoRingSheet } from './PhotoRingSheet'

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }
const label: CSSProperties = { display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }
const box: CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const head: CSSProperties = { margin: '0 0 0.4rem', fontSize: '0.875rem', fontWeight: 600 }
const quiet: CSSProperties = { padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontWeight: 500 }
/** The art keeps its own black and orange in both themes. */
const art: CSSProperties = { borderRadius: 6, overflow: 'hidden', lineHeight: 0, background: 'black' }

const RING = 132

type Making = 'picture' | 'copy' | 'print' | 'sheet' | null

function pressStyle(on: boolean, primary: boolean): CSSProperties {
  if (!on) return { ...quiet, border: 'none', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
  return primary ? { ...quiet, border: 'none', background: '#2563eb', color: 'white' } : quiet
}

export function YourCardCard({
  role,
  userId: userIdProp,
  teammate = null,
  io: ioProp,
  renderer: rendererProp,
  sheetZIndex,
}: {
  role: UserRole | null | undefined
  /** Whose card. Absent: the signed-in person's own. */
  userId?: string
  /** The teammate's name, when the office opens the card for someone else. */
  teammate?: string | null
  io?: CardIo
  renderer?: KitRenderer
  /** Where the photo sheet stacks, when the card sits in a window of its own. */
  sheetZIndex?: number
}) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const W = useMemo(() => cardWordsFor(teammate), [teammate])
  const io = useMemo(() => ioProp ?? supabaseCardIo(), [ioProp])
  const renderer = useMemo(() => rendererProp ?? browserKitRenderer(), [rendererProp])
  const wide = useMatchMedia('(min-width: 860px)')
  const clipId = `kit${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // undefined while reading, null when the read failed
  const [loaded, setLoaded] = useState<CardLoad | null | undefined>(undefined)
  const [kit, setKit] = useState<Required<Pick<KitDrawOptions, 'assets' | 'measure'>> | null>(null)
  const [photo, setPhoto] = useState<CardPhoto | null>(null)
  const [crop, setCrop] = useState<KitCrop | null>(null)
  const [draft, setDraft] = useState({ cardName: '', title: '' })
  // which looks the owner offers, and this person's pick among them
  const [setting, setSetting] = useState<CardLooksSetting>(DEFAULT_CARD_LOOKS)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [making, setMaking] = useState<Making>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => void (live.current = false)
  }, [])

  // A subcontractor is not on the company's card. The office decides who else's card it opens.
  const hidden = !userId || (!teammate && (!role || role === 'subcontractor'))

  useEffect(() => {
    if (hidden || !userId) return
    let on = true
    setLoaded(undefined)
    setProblem(null)
    void (async () => {
      try {
        const [row, ready, looks] = await Promise.all([io.load(userId), renderer.ready(), io.looks()])
        if (!on) return
        setKit(ready)
        setLoaded(row)
        setSetting(looks)
        setPick(row.look)
        setCrop(row.crop)
        setDraft({ cardName: row.facts.card_name ?? '', title: row.facts.title ?? '' })
        if (row.photoPath) {
          const pic = await io.photo(row.photoPath).catch(() => null)
          if (on) setPhoto(pic)
        } else {
          setPhoto(null)
        }
      } catch (e) {
        if (!on) return
        setLoaded(null)
        setProblem(formatErrorMessage(e, W.notRead))
      }
    })()
    return () => {
      on = false
    }
  }, [hidden, userId, io, renderer, W.notRead])

  const person = useMemo(() => {
    if (!loaded) return null
    const kitPhoto = photo && crop ? { ...photo, ...crop } : null
    return kitPersonFromUser({ ...loaded.facts, card_name: draft.cardName, title: draft.title }, PORTAL_COMPANY.phone, kitPhoto)
  }, [loaded, photo, crop, draft])

  const lookId = resolveLook(pick, setting)
  const look = lookLayouts(lookId)

  const drawings = useMemo(() => {
    if (!person || !kit) return null
    const opts = { assets: kit.assets, measure: kit.measure }
    return {
      footer: drawKit(look.footer, person, { ...opts, width: '100%', id: `${clipId}f` }),
      front: drawKit(look.front, null, { ...opts, width: '100%' }),
      back: drawKit(look.back, person, { ...opts, width: '100%', id: `${clipId}b` }),
    }
  }, [person, kit, clipId, look])

  /** The footer in each look the owner offers, drawn with this person's own facts, for the picker. */
  const offered = useMemo(() => {
    if (!person || !kit || !loaded?.lookOn || setting.approved.length < 2) return null
    return setting.approved.map((id) => ({ id, name: THEMES[id].name, svg: drawKit(lookLayouts(id).footer, person, { assets: kit.assets, measure: kit.measure, width: '100%', id: `${clipId}k${id.replace(/[^a-z]/g, '')}` }) }))
  }, [person, kit, loaded?.lookOn, setting, clipId])

  if (hidden) return null

  const hold = person ? cardHold(person) : null
  const holdWords = hold === 'has no photo' ? W.holdNoPhoto : hold === 'has no email' ? W.holdNoEmail : hold === 'has no name' ? W.holdNoName : null
  const tooLong = draft.cardName.length > CARD_NAME_MAX || draft.title.length > CARD_NAME_MAX
  const changed = Boolean(loaded) && (draft.cardName.trim() !== (loaded?.facts.card_name ?? '').trim() || draft.title.trim() !== (loaded?.facts.title ?? '').trim())
  const canSave = changed && !tooLong && !busy
  const canMake = Boolean(drawings) && !hold && !making

  const saveFacts = async () => {
    if (!canSave || !userId || !loaded) return
    setBusy(true)
    setProblem(null)
    try {
      await io.saveFacts(userId, { card_name: draft.cardName, title: draft.title })
      if (!live.current) return
      setLoaded({ ...loaded, facts: { ...loaded.facts, card_name: draft.cardName.trim() || null, title: draft.title.trim() || null } })
      showToast(W.saved, 'success')
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e, W.notSaved))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  const chooseLook = async (id: KitLookId) => {
    if (!userId || id === lookId) return
    const before = pick
    setPick(id)
    setProblem(null)
    try {
      await io.saveLook(userId, id)
      if (live.current) showToast(W.lookSaved, 'success')
    } catch (e) {
      if (!live.current) return
      setPick(before)
      setProblem(formatErrorMessage(e, W.lookNotSaved))
    }
  }

  const savePhoto = async (blob: Blob | null, next: KitCrop) => {
    if (!userId || !loaded) return
    if (blob) {
      const path = await io.savePhoto(userId, blob, next, loaded.photoPath)
      const pic = await io.photo(path)
      if (!live.current) return
      setLoaded({ ...loaded, photoPath: path })
      setPhoto(pic)
    } else {
      await io.saveCrop(userId, next)
      if (!live.current) return
    }
    setCrop(next)
    setSheetOpen(false)
    showToast(W.photoSaved, 'success')
  }

  /** The drawings at their real size, for a file: the previews are drawn to fill their box. */
  const forFile = () => {
    if (!person || !kit) return null
    const opts = { assets: kit.assets, measure: kit.measure }
    return {
      footer: drawKit(look.footer, person, { ...opts, id: `${clipId}ff` }),
      front: drawKit(look.front, null, opts),
      back: drawKit(look.back, person, { ...opts, id: `${clipId}fb` }),
      slug: kitFileSlug(person.name ?? ''),
    }
  }

  const make = async (what: Exclude<Making, null>) => {
    const d = forFile()
    if (!d || !canMake) return
    setMaking(what)
    setProblem(null)
    try {
      const [fw, fh] = look.footer.size
      if (what === 'picture') {
        saveBlobAs(await renderer.png(d.footer, fw, fh), `footer-${d.slug}.png`)
        showToast(W.pictureDone, 'success')
      } else if (what === 'copy') {
        const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
        if (!Item || !navigator.clipboard?.write) {
          showToast(W.cannotCopy, 'warning')
        } else {
          await navigator.clipboard.write([new Item({ 'image/png': renderer.png(d.footer, fw, fh) })])
          showToast(W.pictureCopied, 'success')
        }
      } else if (what === 'print') {
        const pages = [d.front, d.back].map((svg) => ({ svg: printPage(svg), widthIn: 4.25, heightIn: 2.75, dpi: 600 }))
        saveBlobAs(await renderer.pdf(pages), `card-${d.slug}.pdf`)
        showToast(W.printDone, 'success')
      } else {
        const pages = [d.front, d.back].map((svg) => ({ svg: sheetOfTen(svg), widthIn: 8.5, heightIn: 11, dpi: 300 }))
        saveBlobAs(await renderer.pdf(pages), `card-${d.slug}-sheet.pdf`)
        showToast(W.sheetDone, 'success')
      }
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e, W.notMade))
    } finally {
      if (live.current) setMaking(null)
    }
  }

  // the ring's picture sits inside its 4 px border
  const ringAt = photo && crop ? stagePlacement(crop, photo, RING - 8) : null
  const factRow = (name: string, value: string | null | undefined, hint: string) => (
    <div style={{ marginBottom: '0.6rem' }}>
      <span style={label}>{name}</span>
      <div style={{ fontSize: '0.9375rem', minHeight: '1.3em' }}>{value}</div>
      <p style={muted}>{hint}</p>
    </div>
  )

  return (
    <div id="settings-card-and-footer" data-your-card style={card}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>{W.title}</h2>
      <p style={{ ...muted, marginBottom: '0.85rem' }}>{W.lead}</p>

      {loaded === undefined ? <p style={muted}>{W.loading}</p> : null}
      {loaded && !loaded.columnsOn ? <p style={muted}>{W.notYet}</p> : null}

      {loaded && loaded.columnsOn && person ? (
        <div style={{ display: 'grid', gridTemplateColumns: wide ? '300px minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.9rem' }}>
              <div data-your-card-ring style={{ position: 'relative', width: RING, height: RING, flex: 'none', borderRadius: '50%', overflow: 'hidden', border: `4px solid ${look.footer.orange}`, boxSizing: 'border-box', background: 'var(--bg-muted)' }}>
                {photo && ringAt ? <img alt="" src={photo.href} style={{ position: 'absolute', left: ringAt.x, top: ringAt.y, width: ringAt.w, height: ringAt.h, maxWidth: 'none' }} /> : null}
              </div>
              <div>
                <button type="button" onClick={() => setSheetOpen(true)} style={quiet}>
                  {photo ? W.changePhoto : W.addPhoto}
                </button>
                {!photo ? <p style={{ ...muted, marginTop: '0.35rem' }}>{W.ringEmpty}</p> : null}
              </div>
            </div>

            <div style={{ marginBottom: '0.7rem' }}>
              <label htmlFor={`${clipId}-name`} style={label}>
                {W.nameLabel}
              </label>
              <input id={`${clipId}-name`} value={draft.cardName} placeholder={loaded.facts.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, cardName: e.target.value }))} style={box} />
              <p style={muted}>{W.nameHint}</p>
            </div>
            <div style={{ marginBottom: '0.7rem' }}>
              <label htmlFor={`${clipId}-title`} style={label}>
                {W.titleLabel}
              </label>
              <input id={`${clipId}-title`} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} style={box} />
              <p style={muted}>{W.titleHint}</p>
            </div>
            {tooLong ? (
              <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                {W.tooLong}
              </div>
            ) : null}
            <button type="button" onClick={() => void saveFacts()} disabled={!canSave} style={{ ...pressStyle(canSave, true), marginBottom: '1rem' }}>
              {busy ? W.saving : W.save}
            </button>

            {factRow(W.emailLabel, person.email, W.emailHint)}
            {factRow(W.mobileLabel, person.mobile, W.mobileHint)}
            {factRow(W.officeLabel, person.office, W.officeHint)}
          </div>

          <div>
            {drawings ? (
              <>
                {offered ? (
                  <div data-your-card-looks style={{ marginBottom: '1rem' }}>
                    <h3 style={head}>{W.lookLabel}</h3>
                    <div role="radiogroup" aria-label={W.lookLabel} style={{ display: 'grid', gridTemplateColumns: wide ? `repeat(${Math.min(3, offered.length)}, minmax(0, 1fr))` : 'minmax(0, 1fr)', gap: '0.6rem' }}>
                      {offered.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={o.id === lookId}
                          onClick={() => void chooseLook(o.id)}
                          style={{ padding: '0.35rem', borderRadius: 8, border: o.id === lookId ? '2px solid #2563eb' : '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                        >
                          {/* eslint-disable-next-line react/no-danger */}
                          <span style={{ ...art, display: 'block' }} dangerouslySetInnerHTML={{ __html: o.svg }} />
                          <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.8125rem', fontWeight: 600 }}>{o.name}</span>
                        </button>
                      ))}
                    </div>
                    <p style={{ ...muted, marginTop: '0.4rem' }}>{W.lookHint}</p>
                  </div>
                ) : null}
                <h3 style={head}>{W.footerHead}</h3>
                {/* The string is drawKit's own: it escapes every fact, and the pictures in it are data. */}
                {/* eslint-disable-next-line react/no-danger */}
                <div data-your-card-footer style={art} dangerouslySetInnerHTML={{ __html: drawings.footer }} />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button type="button" onClick={() => void make('picture')} disabled={!canMake} style={pressStyle(canMake, true)}>
                    {making === 'picture' ? W.making : W.downloadPicture}
                  </button>
                  <button type="button" onClick={() => void make('copy')} disabled={!canMake} style={pressStyle(canMake, false)}>
                    {making === 'copy' ? W.making : W.copyPicture}
                  </button>
                </div>
                <p style={{ ...muted, marginTop: '0.4rem' }}>{holdWords ?? W.pictureFoot}</p>
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-link)' }}>{W.whereHead}</summary>
                  <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                    {W.where.map(([app, steps]) => (
                      <li key={app} style={{ margin: '0.15rem 0' }}>
                        <strong>{app}</strong> {steps}
                      </li>
                    ))}
                  </ol>
                </details>

                <h3 style={{ ...head, marginTop: '1.1rem' }}>{W.cardHead}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '0.6rem' }}>
                  {/* eslint-disable-next-line react/no-danger */}
                  <div data-your-card-front style={art} dangerouslySetInnerHTML={{ __html: drawings.front }} />
                  {/* eslint-disable-next-line react/no-danger */}
                  <div data-your-card-back style={art} dangerouslySetInnerHTML={{ __html: drawings.back }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button type="button" onClick={() => void make('print')} disabled={!canMake} style={pressStyle(canMake, true)}>
                    {making === 'print' ? W.making : W.downloadPrint}
                  </button>
                  <button type="button" onClick={() => void make('sheet')} disabled={!canMake} style={pressStyle(canMake, false)}>
                    {making === 'sheet' ? W.making : W.downloadSheet}
                  </button>
                </div>
                <p style={{ ...muted, marginTop: '0.4rem' }}>{W.printFoot}</p>
              </>
            ) : (
              <p style={muted}>{W.loading}</p>
            )}
          </div>
        </div>
      ) : null}

      {problem ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.6rem' }}>
          {problem}
        </div>
      ) : null}

      {sheetOpen && crop ? <PhotoRingSheet words={W} photo={photo} crop={crop} zIndex={sheetZIndex} onClose={() => setSheetOpen(false)} onSave={savePhoto} /> : null}
    </div>
  )
}
