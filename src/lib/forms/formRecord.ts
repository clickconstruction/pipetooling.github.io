/**
 * The staff-facing record of a signed form (Contract Forms PR 4): turn the
 * stored non-sensitive answers plus the last-four hints into labelled facts,
 * in the form's own order. Pure; the modal and the Person Desk render it.
 */

import { formatDigitsWithMask, type FormSchema, type FormValues } from './formSchema'

export type FormFact = { key: string; label: string; value: string; sensitive: boolean }

export function formFacts(schema: FormSchema, values: FormValues | null | undefined, hints: Record<string, string> | null | undefined): FormFact[] {
  const v = values ?? {}
  const h = hints ?? {}
  const out: FormFact[] = []
  const seenGroups = new Set<string>()
  for (const b of [...schema.boxes].sort((a, c) => a.order - c.order)) {
    switch (b.type) {
      case 'constant':
      case 'signature':
      case 'date':
        break
      case 'checkbox': {
        if (b.group) {
          if (seenGroups.has(b.group)) break
          seenGroups.add(b.group)
          const g = schema.groups.find((x) => x.key === b.group)
          const chosen = schema.boxes.filter((x) => x.type === 'checkbox' && x.group === b.group && v[x.key] === true).map((x) => x.label)
          if (chosen.length > 0) out.push({ key: b.group, label: g?.label ?? b.group, value: chosen.join(', '), sensitive: false })
        } else if (v[b.key] === true) out.push({ key: b.key, label: b.label, value: 'Yes', sensitive: false })
        break
      }
      case 'text':
      case 'digits': {
        if (b.sensitive) {
          const hint = h[b.key]
          if (hint) out.push({ key: b.key, label: b.label, value: `••••${hint}`, sensitive: true })
          break
        }
        const raw = v[b.key]
        if (typeof raw !== 'string' || !raw.trim()) break
        out.push({ key: b.key, label: b.label, value: b.type === 'digits' && b.mask ? formatDigitsWithMask(raw, b.mask) : raw.trim(), sensitive: false })
        break
      }
    }
  }
  return out
}

/** One line for compact places (Person Desk): "Individual · SSN ••••6789". */
export function formFactsOneLine(facts: FormFact[], max = 3): string {
  return facts
    .slice(0, max)
    .map((f) => (f.sensitive ? `${f.label} ${f.value}` : f.value))
    .join(' · ')
}

export const FORM_SOURCE_LABEL: Record<string, string> = { portal: 'filled on the signing page', paper: 'keyed in from paper' }
