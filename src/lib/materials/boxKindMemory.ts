/**
 * How the last box added on this device sits (punch list #351, PR 1): the Add sheet on the phone and the Add row on
 * the office page open on the kind the person used last, since a site's boxes are mostly one kind. Kept on the device
 * alone, as `boxPageMemory.ts` kept the last scan until v2.7379; browser io with the storage handed in, so the tests hand a map.
 */
import type { BoxKindChoice } from './editBox'
import { BOX_KIND_CHOICES } from './editBox'

export const LAST_BOX_KIND_KEY = 'pt.box.lastKind'

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void }

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The kind the last box added on this device sits as; Cage when none was. */
export function readLastBoxKind(s: Store | null = store()): BoxKindChoice {
  try {
    const v = s?.getItem(LAST_BOX_KIND_KEY)
    return v && (BOX_KIND_CHOICES as readonly string[]).includes(v) ? (v as BoxKindChoice) : 'cage'
  } catch {
    return 'cage'
  }
}

export function rememberBoxKind(kind: BoxKindChoice, s: Store | null = store()): void {
  try {
    s?.setItem(LAST_BOX_KIND_KEY, kind)
  } catch {
    /* a device that keeps nothing still adds the box */
  }
}
