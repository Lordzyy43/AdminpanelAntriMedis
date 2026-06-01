import { supabase } from '../../../lib/supabase'
import type { ClinicBranch, Polyclinic } from '../../../types/queue'

export type PolyclinicPayload = {
  branch_id: string
  name: string
  code: string
  description: string | null
  queue_prefix: string
  is_active: boolean
}

export type PolyclinicDeleteResult = 'archived' | 'deleted'

export async function fetchPolyclinicManagementData() {
  const [branches, polyclinics] = await Promise.all([
    supabase
      .from('clinic_branches')
      .select('id, name, is_active')
      .order('name', { ascending: true }),
    supabase
      .from('polyclinics')
      .select('id, branch_id, name, code, description, queue_prefix, is_active')
      .order('name', { ascending: true }),
  ])

  if (branches.error) throw branches.error
  if (polyclinics.error) throw polyclinics.error

  return {
    branches: branches.data as ClinicBranch[],
    polyclinics: polyclinics.data as Polyclinic[],
  }
}

export async function createPolyclinic(payload: PolyclinicPayload) {
  const { error } = await supabase.from('polyclinics').insert(payload)
  if (error) throw error
}

export async function updatePolyclinic(
  polyclinicId: string,
  payload: PolyclinicPayload,
) {
  const { error } = await supabase
    .from('polyclinics')
    .update(payload)
    .eq('id', polyclinicId)

  if (error) throw error
}

export async function deletePolyclinic(polyclinicId: string) {
  const { data, error } = await supabase.rpc('delete_polyclinic_if_unused', {
    p_polyclinic_id: polyclinicId,
  })

  if (error) throw error
  return data as PolyclinicDeleteResult
}
