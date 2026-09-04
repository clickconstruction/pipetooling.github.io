/**
 * Fill-on-the-document — pure helpers for the signer's side (Contract Forms PR 3).
 *
 * The signer sees the real page with inputs at the boxes. On a phone a "lens"
 * under the page magnifies the current box and steps through them in the
 * dev-set order. This file decides what the lens shows, how a value displays
 * (masks, sensitive dots), which boxes are asked, and the English / Español
 * chrome strings. No React, no DOM.
 */

import { askedBoxes, formatDigitsWithMask, isFilled, onlyDigits, validateFormValues, type FormBox, type FormSchema, type FormValidationError, type FormValues } from './formSchema'

export type FillLang = 'en' | 'es'

/** Boxes the overlay renders as inputs (signature is handled by the signing form beneath the page). */
export function fillableBoxes(schema: FormSchema): FormBox[] {
  return askedBoxes(schema).filter((b) => b.type !== 'signature')
}

/** The lens sequence: fillable boxes, skipping "rarely needed" ones unless expanded. */
export function lensSequence(schema: FormSchema, showAdvanced: boolean): FormBox[] {
  return fillableBoxes(schema).filter((b) => showAdvanced || !b.advanced)
}

export function hasAdvancedBoxes(schema: FormSchema): boolean {
  return fillableBoxes(schema).some((b) => b.advanced)
}

export function boxLabel(box: FormBox, lang: FillLang): string {
  return (lang === 'es' && box.labelEs?.trim()) || box.label || box.key
}

export function boxHelp(box: FormBox, lang: FillLang): string | null {
  const h = (lang === 'es' && box.helpEs?.trim()) || box.help || ''
  return h.trim() || null
}

/** What a text / digits box shows when it is not being edited. Sensitive boxes show dots plus the last two. */
export function displayValue(box: FormBox, value: string | boolean | undefined, focused: boolean): string {
  if (typeof value !== 'string' || !value) return ''
  if (box.type === 'digits') {
    const shown = box.mask ? formatDigitsWithMask(value, box.mask) : onlyDigits(value)
    if (box.sensitive && !focused) return maskSensitive(shown)
    return shown
  }
  if (box.sensitive && !focused) return maskSensitive(value)
  return value
}

/** "123-45-6789" → "•••-••-••89": keep separators, hide all but the last two characters. */
export function maskSensitive(shown: string): string {
  const chars = [...shown]
  const alnum = chars.map((c, i) => (/[0-9a-z]/i.test(c) ? i : -1)).filter((i) => i >= 0)
  const keep = new Set(alnum.slice(-2))
  return chars.map((c, i) => (/[0-9a-z]/i.test(c) && !keep.has(i) ? '•' : c)).join('')
}

/** Normalise what the signer typed into a digits box: digits only, capped at the mask length. */
export function acceptDigitsInput(box: FormBox, raw: string): string {
  const digits = onlyDigits(raw)
  const cap = box.mask ? (box.mask.match(/#/g) ?? []).length : 0
  return cap > 0 ? digits.slice(0, cap) : digits
}

/**
 * Toggle a checkbox. In an exactly-one group, checking one clears its
 * siblings; checking an already-checked box in such a group leaves it checked.
 */
export function toggleCheckbox(schema: FormSchema, values: FormValues, key: string): FormValues {
  const box = schema.boxes.find((b) => b.key === key)
  if (!box || box.type !== 'checkbox') return values
  const group = box.group ? schema.groups.find((g) => g.key === box.group) : undefined
  const next: FormValues = { ...values }
  if (group?.exactlyOne) {
    for (const b of schema.boxes) if (b.type === 'checkbox' && b.group === group.key) delete next[b.key]
    next[key] = true
    return next
  }
  if (values[key] === true) delete next[key]
  else next[key] = true
  return next
}

/** Filling one member of a one-of set clears the others (SSN vs EIN). */
export function setOneOfValue(schema: FormSchema, values: FormValues, key: string, value: string): FormValues {
  const box = schema.boxes.find((b) => b.key === key)
  const next: FormValues = { ...values }
  if (value === '') delete next[key]
  else next[key] = value
  if (box?.oneOf && value !== '') {
    for (const b of schema.boxes) if (b.key !== key && b.oneOf === box.oneOf) delete next[b.key]
  }
  return next
}

export type FillProgress = { required: number; requiredDone: number; total: number; done: number }

export function fillProgress(schema: FormSchema, values: FormValues): FillProgress {
  const boxes = fillableBoxes(schema)
  const groups = new Map(schema.groups.map((g) => [g.key, g]))
  const oneOfs = new Map(schema.oneOfs.map((o) => [o.key, o]))
  let required = 0
  let requiredDone = 0
  let done = 0
  const seenSets = new Set<string>()
  for (const b of boxes) {
    const filled = isFilled(values[b.key])
    if (filled) done++
    if (b.type === 'checkbox' && b.group) {
      const g = groups.get(b.group)
      if (g?.required && !seenSets.has(`g:${g.key}`)) {
        seenSets.add(`g:${g.key}`)
        required++
        if (schema.boxes.some((x) => x.group === g.key && values[x.key] === true)) requiredDone++
      }
      continue
    }
    if (b.oneOf) {
      const o = oneOfs.get(b.oneOf)
      if (o?.required && !seenSets.has(`o:${o.key}`)) {
        seenSets.add(`o:${o.key}`)
        required++
        if (schema.boxes.some((x) => x.oneOf === o.key && isFilled(values[x.key]))) requiredDone++
      }
      continue
    }
    if (b.required) {
      required++
      if (filled) requiredDone++
    }
  }
  return { required, requiredDone, total: boxes.length, done }
}

/** Validation messages keyed for display: box errors on the box, set errors on their members. */
export function errorsByBox(schema: FormSchema, values: FormValues): Record<string, string> {
  const out: Record<string, string> = {}
  const errs: FormValidationError[] = validateFormValues(schema, values)
  for (const e of errs) {
    if (schema.boxes.some((b) => b.key === e.key)) out[e.key] = out[e.key] ?? e.message
    else {
      for (const b of schema.boxes) if ((b.group === e.key || b.oneOf === e.key) && !out[b.key]) out[b.key] = e.message
    }
  }
  return out
}

/** Fit a page to a container width; never upscale past 1.6 px/pt. */
export function fitScale(containerWidth: number, pageWidth: number): number {
  if (!(containerWidth > 0) || !(pageWidth > 0)) return 1
  return Math.min(1.6, Math.max(0.3, (containerWidth - 2) / pageWidth))
}

const STRINGS: Record<FillLang, Record<string, string>> = {
  en: {
    fillTitle: 'Fill in this form',
    fillIntro: 'Type into the boxes on the page. What you enter goes onto this form and nowhere else.',
    lensIntro: 'Tap a box on the form, or use Next.',
    next: 'Next',
    back: 'Back',
    of: 'of',
    required: 'required',
    optional: 'optional',
    rarelyNeeded: 'Rarely needed',
    showRarely: 'Show rarely-needed lines',
    hideRarely: 'Hide rarely-needed lines',
    progress: '{done} of {total} filled',
    sensitiveNote: 'Shown as dots once you leave this box. It goes onto this form only.',
    checkOne: 'Pick one',
    signHeading: 'Sign this form',
    agree: 'I have read this form and my answers are true and correct.',
    disclosure: 'By signing, you certify the information on this form. Typing or drawing your signature here has the same force and effect as your written signature.',
    submit: 'Sign and submit',
    fixFirst: 'Please complete the highlighted boxes first.',
    language: 'Español',
    pinch: 'Pinch to zoom the page.',
    signatureHere: 'Your signature will appear here',
  },
  es: {
    fillTitle: 'Complete este formulario',
    fillIntro: 'Escriba en las casillas de la página. Lo que ingrese va a este formulario y a ningún otro lugar.',
    lensIntro: 'Toque una casilla en el formulario o use Siguiente.',
    next: 'Siguiente',
    back: 'Atrás',
    of: 'de',
    required: 'obligatorio',
    optional: 'opcional',
    rarelyNeeded: 'Rara vez necesario',
    showRarely: 'Mostrar líneas rara vez necesarias',
    hideRarely: 'Ocultar líneas rara vez necesarias',
    progress: '{done} de {total} completadas',
    sensitiveNote: 'Se muestra con puntos al salir de esta casilla. Solo va a este formulario.',
    checkOne: 'Elija una',
    signHeading: 'Firme este formulario',
    agree: 'He leído este formulario y mis respuestas son verdaderas y correctas.',
    disclosure: 'Al firmar, usted certifica la información de este formulario. Escribir o dibujar su firma aquí tiene la misma validez que su firma manuscrita.',
    submit: 'Firmar y enviar',
    fixFirst: 'Primero complete las casillas marcadas.',
    language: 'English',
    pinch: 'Pellizque para ampliar la página.',
    signatureHere: 'Su firma aparecerá aquí',
  },
}

export function fillString(lang: FillLang, key: string, vars?: Record<string, string | number>): string {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v))
  return s
}
