/**
 * The Reminders the app offers card's one read of its own (`remindersCard.ts`, v2.5720): the flows Settings → Flows
 * edits, as saved, through the boards' per-kind read (`flowsIo.ts`'s `loadFlowDef`, which keeps a kind once read and
 * answers the seed for a kind not on the database). The switch and the quick replies come through the Flows tab's own
 * io (`flows/appSendsIo.ts`), so there is one write. One function, so the card's smoke hands it a fake.
 */
import type { FlowKind } from '../flows/facts'
import { loadFlowDef } from '../flows/flowsIo'
import type { FlowDef } from '../flows/state'
import { REMINDER_FLOW_KINDS, type ReminderFlows } from './remindersCard'

/** Every flow the card lists, by kind. A kind whose read throws is left out, so the rest still draw. */
export async function loadReminderFlows(load: (kind: FlowKind) => Promise<FlowDef> = loadFlowDef): Promise<ReminderFlows> {
  const read = await Promise.all(
    REMINDER_FLOW_KINDS.map(async (kind) => {
      try {
        return [kind, await load(kind)] as const
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(read.filter((r): r is readonly [FlowKind, FlowDef] => r !== null))
}
