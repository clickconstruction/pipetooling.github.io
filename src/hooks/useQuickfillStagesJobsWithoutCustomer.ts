import { useEffect, useMemo } from 'react'
import { useAuth } from './useAuth'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import {
  buildStagesJobsWithoutCustomerList,
  buildStagesWorkingJobsWithoutPicturesList,
} from '../lib/jobsStagesBoard'

const ROLES = new Set<string>(['dev', 'master_technician', 'assistant', 'controller'])

export function useQuickfillStagesJobsWithoutCustomer(): {
  jobsWithoutCustomer: ReturnType<typeof buildStagesJobsWithoutCustomerList>
  workingJobsWithoutPictures: ReturnType<typeof buildStagesWorkingJobsWithoutPicturesList>
  loading: boolean
  jobsListBusy: boolean
  fetchEnabled: boolean
} {
  const { user: authUser, role } = useAuth()
  const { jobs, jobsListLoading, jobsListRefreshing, runFetchJobs } = useJobsListCache()

  const fetchEnabled = Boolean(authUser?.id && role && ROLES.has(role))

  useEffect(() => {
    if (!fetchEnabled) return
    void runFetchJobs(null)
  }, [fetchEnabled, runFetchJobs])

  const jobsWithoutCustomer = useMemo(
    () => (fetchEnabled ? buildStagesJobsWithoutCustomerList(jobs, '', null) : []),
    [fetchEnabled, jobs],
  )

  const workingJobsWithoutPictures = useMemo(
    () => (fetchEnabled ? buildStagesWorkingJobsWithoutPicturesList(jobs, '', null) : []),
    [fetchEnabled, jobs],
  )

  const loading = fetchEnabled && jobsListLoading
  const jobsListBusy = jobsListLoading || jobsListRefreshing

  return {
    jobsWithoutCustomer,
    workingJobsWithoutPictures,
    loading,
    jobsListBusy,
    fetchEnabled,
  }
}
