/**
 * The office's save of a license target (punch list #255, v2.6626): one `license_targets` row a person and trade,
 * written under the Licenses audience's RLS. Thin IO over the kernel in `licenseTarget.ts`.
 */
import { supabase } from '../supabase'
import type { LicenseTarget } from './logbook'

export async function saveLicenseTarget(userId: string, target: LicenseTarget): Promise<void> {
  // The row's default sets updated_by on the insert alone; an edit names the editor here.
  const by = await supabase.auth.getUser().then((r) => r.data.user?.id ?? null).catch(() => null)
  const { error } = await supabase
    .from('license_targets' as never)
    .upsert(
      {
        user_id: userId,
        trade: target.trade,
        target_class: target.targetClass,
        target_amount: target.targetAmount,
        opening_amount: target.openingAmount,
        opening_source: target.openingSource,
        updated_at: new Date().toISOString(),
        ...(by ? { updated_by: by } : {}),
      } as never,
      { onConflict: 'user_id,trade' },
    )
  if (error) throw error
}
