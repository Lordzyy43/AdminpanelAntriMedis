import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldAlert } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import { getCurrentSessionWithRoles } from '../services/auth-service'
import { supabase } from '../../../lib/supabase'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const sessionQuery = useQuery({
    queryKey: ['auth-session'],
    queryFn: getCurrentSessionWithRoles,
  })

  if (sessionQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="animate-spin" size={24} />
      </main>
    )
  }

  if (!sessionQuery.data?.session) {
    return <Navigate replace to="/login" />
  }

  if (!sessionQuery.data.isStaff) {
    return <ForbiddenState />
  }

  return children
}

function ForbiddenState() {
  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-900/5">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <ShieldAlert size={24} />
        </div>
        <h1 className="text-xl font-black text-slate-950">Akses Admin Ditolak</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Akun ini tidak memiliki role admin, dokter, owner, atau super admin.
        </p>
        <Button className="mt-5 w-full" variant="secondary" onClick={signOut}>
          Keluar
        </Button>
      </div>
    </main>
  )
}
