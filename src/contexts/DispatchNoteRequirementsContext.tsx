import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultDispatchNoteRequirementsConfig,
  fetchDispatchNoteRequirementsConfigFromAppSettings,
  noteRequirementForBlock,
  noteRequirementForUserId,
  type DispatchNoteRequirement,
  type DispatchNoteRequirementsConfigV1,
} from '../lib/dispatchNoteRequirements'

export type DispatchNoteRequirementsContextValue = {
  config: DispatchNoteRequirementsConfigV1
  requirementForUserId: (userId: string | null | undefined) => DispatchNoteRequirement
  requirementForBlock: (input: {
    userId: string | null | undefined
    jobId: string | null | undefined
  }) => DispatchNoteRequirement
  reload: () => Promise<void>
}

const DispatchNoteRequirementsContext = createContext<DispatchNoteRequirementsContextValue>({
  config: defaultDispatchNoteRequirementsConfig(),
  requirementForUserId: () => 'default',
  requirementForBlock: () => 'default',
  reload: async () => {},
})

type ProviderProps = {
  children: ReactNode
  authUserId: string | null
}

export function DispatchNoteRequirementsProvider({ children, authUserId }: ProviderProps) {
  const [config, setConfig] = useState<DispatchNoteRequirementsConfigV1>(() =>
    defaultDispatchNoteRequirementsConfig(),
  )

  const load = useCallback(async () => {
    if (!authUserId) {
      setConfig(defaultDispatchNoteRequirementsConfig())
      return
    }
    try {
      const { config: cfg } = await fetchDispatchNoteRequirementsConfigFromAppSettings()
      setConfig(cfg)
    } catch {
      setConfig(defaultDispatchNoteRequirementsConfig())
    }
  }, [authUserId])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<DispatchNoteRequirementsContextValue>(
    () => ({
      config,
      requirementForUserId: (userId) => noteRequirementForUserId(config, userId),
      requirementForBlock: (input) => noteRequirementForBlock(config, input),
      reload: load,
    }),
    [config, load],
  )

  return (
    <DispatchNoteRequirementsContext.Provider value={value}>
      {children}
    </DispatchNoteRequirementsContext.Provider>
  )
}

export function useDispatchNoteRequirements(): DispatchNoteRequirementsContextValue {
  return useContext(DispatchNoteRequirementsContext)
}
