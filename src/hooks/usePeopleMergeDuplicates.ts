import { useEffect, useState } from 'react'
import {
  findPersonUserDuplicates,
  mergePersonIntoUser,
  type PayConfigRowForMerge,
  type PersonForMerge,
  type PersonUserDuplicate,
  type UserRowForMerge,
} from '../lib/mergePersonUserDuplicates'

export type UsePeopleMergeDuplicatesInput = {
  /** The Hours tab is open and the viewer can see pay: only then are duplicates looked for. */
  enabled: boolean
  people: PersonForMerge[]
  users: UserRowForMerge[]
  payConfig: Record<string, PayConfigRowForMerge>
  setError: (value: string | null) => void
  loadPayConfig: () => Promise<unknown>
  /** After a merge from the banner: the page reloads the Hours grid when it is showing. */
  afterMerge: () => void
}

export type PeopleMergeDuplicatesApi = {
  mergeDuplicates: PersonUserDuplicate[]
  mergingPersonName: string | null
  handleMergeDuplicate: (dup: PersonUserDuplicate) => Promise<void>
  /** Drops one duplicate from the banner: the page's invite flow merges the one it just invited. */
  dropMergeDuplicate: (personName: string) => void
}

/**
 * People → Hours: the banner of person/user duplicates (a pay name for a roster person and for
 * the account sharing their email) and its Merge button (#46 row 6, v2.4945).
 */
export function usePeopleMergeDuplicates({
  enabled,
  people,
  users,
  payConfig,
  setError,
  loadPayConfig,
  afterMerge,
}: UsePeopleMergeDuplicatesInput): PeopleMergeDuplicatesApi {
  const [mergeDuplicates, setMergeDuplicates] = useState<PersonUserDuplicate[]>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)

  useEffect(() => {
    if (enabled && Object.keys(payConfig).length > 0) {
      const dups = findPersonUserDuplicates(people, users, payConfig)
      setMergeDuplicates(dups)
    } else {
      setMergeDuplicates([])
    }
  }, [enabled, payConfig, people, users])

  function dropMergeDuplicate(personName: string) {
    setMergeDuplicates((prev) => prev.filter((x) => x.personName !== personName))
  }

  async function handleMergeDuplicate(dup: PersonUserDuplicate) {
    setMergingPersonName(dup.personName)
    setError(null)
    let userId: string | undefined
    if (dup.email?.trim()) {
      userId = users.find((u) => u.email?.toLowerCase() === dup.email?.toLowerCase())?.id
    } else {
      userId = users.find((u) => u.name?.trim() === dup.personName)?.id ?? users.find((u) => u.name?.trim() === dup.userDisplayName)?.id
    }
    try {
      await mergePersonIntoUser(
        dup.personName,
        dup.userDisplayName,
        payConfig,
        userId,
        people.map((p) => ({ id: p.id, name: p.name, email: p.email })),
      )
      await loadPayConfig()
      dropMergeDuplicate(dup.personName)
      afterMerge()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  return { mergeDuplicates, mergingPersonName, handleMergeDuplicate, dropMergeDuplicate }
}
