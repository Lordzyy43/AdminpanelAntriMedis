import { supabase } from '../../../lib/supabase'
import type { Doctor, Polyclinic } from '../../../types/queue'

export type DoctorPayload = {
  full_name: string
  license_number: string | null
  specialization: string | null
  bio: string | null
  default_service_minutes: number
  is_active: boolean
}

export type DoctorSavePayload = DoctorPayload & {
  polyclinic_ids: string[]
}

export type DoctorDeleteResult = 'archived' | 'deleted'

export type DoctorPolyclinicReference = {
  doctor_id: string
  polyclinic_id: string
}

export async function fetchDoctorManagementData() {
  const [doctors, polyclinics, doctorPolyclinics] = await Promise.all([
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
    supabase
      .from('doctor_polyclinics')
      .select('doctor_id, polyclinic_id'),
  ])

  if (doctors.error) throw doctors.error
  if (polyclinics.error) throw polyclinics.error
  if (doctorPolyclinics.error) throw doctorPolyclinics.error

  return {
    doctors: doctors.data as Doctor[],
    doctorPolyclinics: doctorPolyclinics.data as DoctorPolyclinicReference[],
    polyclinics: polyclinics.data as Polyclinic[],
  }
}

export async function fetchDoctors() {
  const data = await fetchDoctorManagementData()
  return data.doctors
}

export async function createDoctor(payload: DoctorSavePayload) {
  const { polyclinic_ids: polyclinicIds, ...doctorPayload } = payload
  const { data, error } = await supabase
    .from('doctors')
    .insert(doctorPayload)
    .select('id')
    .single()

  if (error) throw error
  try {
    await syncDoctorPolyclinics(data.id as string, polyclinicIds)
  } catch (syncError) {
    await supabase.from('doctors').delete().eq('id', data.id as string)
    throw syncError
  }
}

export async function updateDoctor(doctorId: string, payload: DoctorSavePayload) {
  const { polyclinic_ids: polyclinicIds, ...doctorPayload } = payload
  const { error } = await supabase
    .from('doctors')
    .update(doctorPayload)
    .eq('id', doctorId)

  if (error) throw error
  await syncDoctorPolyclinics(doctorId, polyclinicIds)
}

export async function deleteDoctor(doctorId: string) {
  const { data, error } = await supabase.rpc('delete_doctor_if_unused', {
    p_doctor_id: doctorId,
  })

  if (error) throw error
  return data as DoctorDeleteResult
}

async function syncDoctorPolyclinics(
  doctorId: string,
  polyclinicIds: string[],
) {
  const uniquePolyclinicIds = Array.from(new Set(polyclinicIds))
  const { data: existingRelations, error: existingError } = await supabase
    .from('doctor_polyclinics')
    .select('polyclinic_id')
    .eq('doctor_id', doctorId)

  if (existingError) throw existingError

  const existingPolyclinicIds = new Set(
    (existingRelations as Array<{ polyclinic_id: string }> | null)?.map(
      (relation) => relation.polyclinic_id,
    ) ?? [],
  )
  const requestedPolyclinicIds = new Set(uniquePolyclinicIds)
  const polyclinicIdsToAdd = uniquePolyclinicIds.filter(
    (polyclinicId) => !existingPolyclinicIds.has(polyclinicId),
  )
  const polyclinicIdsToRemove = Array.from(existingPolyclinicIds).filter(
    (polyclinicId) => !requestedPolyclinicIds.has(polyclinicId),
  )

  if (polyclinicIdsToAdd.length > 0) {
    const { error: insertError } = await supabase
      .from('doctor_polyclinics')
      .insert(
        polyclinicIdsToAdd.map((polyclinicId) => ({
          doctor_id: doctorId,
          polyclinic_id: polyclinicId,
        })),
      )

    if (insertError) throw insertError
  }

  if (polyclinicIdsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('doctor_polyclinics')
      .delete()
      .eq('doctor_id', doctorId)
      .in('polyclinic_id', polyclinicIdsToRemove)

    if (deleteError) throw deleteError
  }
}
