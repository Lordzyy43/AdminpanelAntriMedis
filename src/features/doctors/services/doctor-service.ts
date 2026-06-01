import { supabase } from '../../../lib/supabase'
import type { Doctor } from '../../../types/queue'

export type DoctorPayload = {
  full_name: string
  license_number: string | null
  specialization: string | null
  bio: string | null
  default_service_minutes: number
  is_active: boolean
}

export type DoctorDeleteResult = 'archived' | 'deleted'

export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select(
      'id, full_name, license_number, specialization, bio, default_service_minutes, is_active',
    )
    .order('full_name', { ascending: true })

  if (error) throw error
  return data as Doctor[]
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

export async function deleteDoctor(doctorId: string) {
  const { data, error } = await supabase.rpc('delete_doctor_if_unused', {
    p_doctor_id: doctorId,
  })

  if (error) throw error
  return data as DoctorDeleteResult
}
