/**
 * Supply house bill lines, the reads and the one write behind Codes with no part (punch list #298 PR 2a, v2.7121).
 * The lines are the purchase view's (`purchaseLinesIo.ts`), so only bills whose lines add up are behind a code's
 * dollars. The book is the parts catalog, a robot's parts left out. The write is `keepHouseCode`, the crosswalk's
 * own door (punch list #308), which the table's policy holds to the people who may edit the parts book. One
 * interface, so a smoke hands the window a fake.
 */
import type { BookPart } from '../partMatch'
import { keepHouseCode, type KeepHouseCodeInput } from '../houseCodes'
import { loadWholePartsCatalog } from '../partsCatalog'
import { supabasePurchaseLinesIo } from './purchaseLinesIo'
import type { CodeLine } from './codesWithNoPart'
import type { CodeTeach } from './whatWeBuy'

export interface CodesData {
  lines: CodeLine[]
  teaches: CodeTeach[]
  houseNames: Map<string, string>
  book: BookPart[]
}

export interface CodesIo {
  /** Rejects with the database's error when a read fails. */
  load(): Promise<CodesData>
  /** Keeps one code on the crosswalk: a part, or the mark that it is not a part. Resolves to the reason when it is refused. */
  keep(input: KeepHouseCodeInput): Promise<{ error: string | null }>
}

export function supabaseCodesIo(): CodesIo {
  const purchases = supabasePurchaseLinesIo()
  return {
    async load() {
      const { supabase } = await import('../../supabase')
      const [data, parts] = await Promise.all([purchases.load(), loadWholePartsCatalog<{ id: string; name: string; manufacturer: string | null; is_robot: boolean | null }>(supabase, 'id,name,manufacturer,is_robot')])
      return { lines: data.lines, teaches: data.teaches, houseNames: data.houseNames, book: parts.filter((p) => !p.is_robot).map((p) => ({ id: p.id, name: p.name, manufacturer: p.manufacturer })) }
    },
    async keep(input) {
      const { supabase } = await import('../../supabase')
      const { error } = await keepHouseCode(supabase, input)
      return { error }
    },
  }
}
