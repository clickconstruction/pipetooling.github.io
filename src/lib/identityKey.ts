/** Client re-export of the shared identity-key kernel (Tier 5 X7). See `supabase/functions/_shared/identityKey.ts`. */
export {
  findLooseIdentityPairs,
  identityKeysLooselyEqual,
  identityTokens,
  identityTokensCovered,
  normalizeIdentityKey,
  type IdentityCluster,
} from '../../supabase/functions/_shared/identityKey'
