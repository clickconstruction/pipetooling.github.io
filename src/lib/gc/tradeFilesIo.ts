/**
 * GC mode, the trade partner portal's P5a-2: where the office reads the waivers a trade signed in its portal, as the
 * PDFs `submit-gc-trade-portal` filed (`gc_trade_files`, migration 20261010100000). The office team reads every row;
 * anyone else reads none. The Draws and Closeout windows read the open job's when they open and after each reload.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { WaiverFileRow } from './tradeFiles'

/** The job's signed waivers, each with its draw and its form. */
export async function loadGcWaiverFiles(projectId: string): Promise<WaiverFileRow[]> {
  const result = await supabase.from('gc_trade_files').select('record_id, paper, drive_url, uploaded_at').eq('project_id', projectId).eq('purpose', 'waiver')
  checkSupabaseError(result, 'load the signed waivers')
  return result.data ?? []
}
