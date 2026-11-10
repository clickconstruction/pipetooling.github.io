/**
 * Bid photos (punch list #306): where a bid's photos go in Drive, how a filed photo is named, which pictures in the
 * folder the app adopts, and the words for a folder the app cannot file into. The rules live in
 * `supabase/functions/_shared/bidPhotos.ts`, with no imports, so the `bid-photos` function, the `photo-save` sweep and
 * the Bid Board's photos window read one implementation; this file is the app's door to it, as
 * `documents/folderName.ts` is to its kernel.
 */
export * from '../../../supabase/functions/_shared/bidPhotos'
