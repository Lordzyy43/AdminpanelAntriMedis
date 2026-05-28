import { supabase } from '../../../lib/supabase'

export type StaffRole = 'admin' | 'doctor' | 'owner' | 'super_admin'

type RoleResponse = {
  role_code: string
}

const staffRoles: StaffRole[] = ['admin', 'doctor', 'owner', 'super_admin']

export async function getCurrentSessionWithRoles() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  if (!sessionData.session) {
    return {
      isStaff: false,
      roles: [] as string[],
      session: null,
    }
  }

  const { data: rolesData, error: rolesError } = await supabase.rpc('get_my_roles')
  if (rolesError) throw rolesError

  const roles = ((rolesData ?? []) as RoleResponse[]).map(
    (role: RoleResponse) => role.role_code,
  )

  return {
    isStaff: roles.some((role) => staffRoles.includes(role as StaffRole)),
    roles,
    session: sessionData.session,
  }
}
