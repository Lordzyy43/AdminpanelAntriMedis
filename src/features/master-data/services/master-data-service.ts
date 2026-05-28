import { supabase } from '../../../lib/supabase'
import type { ClinicBranch, Doctor, Polyclinic } from '../../../types/queue'

export type DoctorPayload = {
  full_name: string
  license_number: string | null
  specialization: string | null
  bio: string | null
  default_service_minutes: number
  is_active: boolean
}

export type PolyclinicPayload = {
  branch_id: string
  name: string
  code: string
  description: string | null
  queue_prefix: string
  is_active: boolean
}

export async function fetchMasterData() {
  const [branches, doctors, polyclinics] = await Promise.all([
    supabase
      .from('clinic_branches')
      .select('id, name, is_active')
      .order('name', { ascending: true }),
    supabase
      .from('doctors')
      .select(
        'id, full_name, license_number, specialization, bio, default_service_minutes, is_active',
      )
      .order('full_name', { ascending: true }),
    supabase
      .from('polyclinics')
      .select('id, branch_id, name, code, description, queue_prefix, is_active')
      .order('name', { ascending: true }),
  ])

  if (branches.error) throw branches.error
  if (doctors.error) throw doctors.error
  if (polyclinics.error) throw polyclinics.error

  return {
    branches: branches.data as ClinicBranch[],
    doctors: doctors.data as Doctor[],
    polyclinics: polyclinics.data as Polyclinic[],
  }
}

export async function createDoctor(payload: DoctorPayload) {
  const { error } = await supabase.from('doctors').insert(payload)
  if (error) throw error
}

export async function updateDoctor(doctorId: string, payload: DoctorPayload) {
  const { error } = await supabase
    .from('doctors')
    .update(payload)
    .eq('id', doctorId)

  if (error) throw error
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
