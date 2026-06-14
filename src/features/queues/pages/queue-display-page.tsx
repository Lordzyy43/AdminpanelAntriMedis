import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Clock3, RefreshCw } from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { Button } from '../../../components/ui/button'
import { supabase } from '../../../lib/supabase'
import type { QueueStatus, QueueTicketDetail, ScheduleAvailability } from '../../../types/queue'
import { fetchQueueTickets, fetchSchedules } from '../services/queue-service'

const today = toDateInputValue(new Date())

export function QueueDisplayPage() {
  const queryClient = useQueryClient()
  const schedulesQuery = useQuery({
    queryKey: ['queue-display-schedules', today],
    queryFn: () => fetchSchedules(today),
  })

  const schedules = useMemo(
    () => schedulesQuery.data ?? [],
    [schedulesQuery.data],
  )
  const activeSchedule = useMemo(
    () => pickDisplaySchedule(schedules),
    [schedules],
  )
  const ticketsQuery = useQuery({
    queryKey: ['queue-display-tickets', activeSchedule?.queue_session_id],
    queryFn: () => fetchQueueTickets(activeSchedule!.queue_session_id!),
    enabled: Boolean(activeSchedule?.queue_session_id),
  })
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data])
  const currentTicket = useMemo(() => pickCurrentTicket(tickets), [tickets])
  const waitingCount = tickets.filter((ticket) => ticket.status === 'waiting').length

  useEffect(() => {
    const channel = supabase
      .channel('queue-display-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_tickets' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['queue-display-tickets'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_sessions' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['queue-display-schedules'] })
          void queryClient.invalidateQueries({ queryKey: ['queue-display-tickets'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctor_schedules' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['queue-display-schedules'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen flex-col px-10 py-8">
        <header className="flex items-center justify-between gap-6">
          <div>
            <p className="text-lg font-black uppercase tracking-wide text-teal-300">
              Display Antrean
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              AntriMedis
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-right">
              <p className="text-xs font-black uppercase text-slate-300">
                Hari Ini
              </p>
              <p className="text-2xl font-black">{formatDateLabel(today)}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                void schedulesQuery.refetch()
                void ticketsQuery.refetch()
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-10">
            <p className="text-xl font-black uppercase tracking-wide text-slate-300">
              Nomor Antrean Saat Ini
            </p>
            <div className="mt-8 flex min-h-[260px] items-center justify-center rounded-[2rem] bg-teal-400 text-slate-950">
              <span className="text-[clamp(6rem,18vw,15rem)] font-black leading-none tracking-tight">
                {currentTicket?.queue_code ?? '-'}
              </span>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <DisplayMetric
                label="Status"
                value={currentTicket ? queueStatusLabel(currentTicket.status) : 'Standby'}
              />
              <DisplayMetric
                label="Menunggu"
                value={waitingCount}
              />
              <DisplayMetric
                label="Terakhir"
                value={activeSchedule?.last_number ?? 0}
              />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
                <Activity size={32} />
              </div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-300">
                Poli
              </p>
              <h2 className="mt-2 text-4xl font-black leading-tight">
                {activeSchedule?.polyclinic_name ?? 'Belum ada sesi'}
              </h2>
              <p className="mt-5 text-sm font-black uppercase tracking-wide text-slate-300">
                Dokter
              </p>
              <p className="mt-2 text-2xl font-black">
                {activeSchedule?.doctor_name ?? '-'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
              <div className="flex items-center gap-3 text-slate-300">
                <Clock3 size={24} />
                <p className="text-sm font-black uppercase tracking-wide">
                  Jam Praktik
                </p>
              </div>
              <p className="mt-3 text-4xl font-black">
                {activeSchedule
                  ? `${activeSchedule.start_time.slice(0, 5)}-${activeSchedule.end_time.slice(0, 5)}`
                  : '--:-----:--'}
              </p>
              <p className="mt-6 rounded-2xl bg-white/10 px-5 py-4 text-2xl font-black">
                {currentTicket
                  ? currentTicket.status === 'serving'
                    ? 'Sedang dilayani'
                    : 'Sedang dipanggil'
                  : schedulesQuery.isLoading || ticketsQuery.isLoading
                    ? 'Memuat data'
                    : 'Menunggu pemanggilan'}
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function DisplayMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-2xl bg-slate-950/60 px-5 py-4">
      <p className="text-sm font-black uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

function pickDisplaySchedule(schedules: ScheduleAvailability[]) {
  return (
    schedules.find((schedule) => schedule.queue_session_id && schedule.current_number > 0) ??
    schedules.find((schedule) => schedule.queue_session_id) ??
    null
  )
}

function pickCurrentTicket(tickets: QueueTicketDetail[]) {
  return (
    tickets.find((ticket) => ticket.status === 'serving') ??
    tickets.find((ticket) => ticket.status === 'called') ??
    null
  )
}

function queueStatusLabel(status: QueueStatus) {
  const labels: Record<QueueStatus, string> = {
    waiting: 'Menunggu',
    called: 'Dipanggil',
    serving: 'Dilayani',
    missed: 'Terlewat',
    completed: 'Selesai',
    skipped: 'Dilewati',
    cancelled: 'Dibatalkan',
    expired: 'Kedaluwarsa',
  }
  return labels[status]
}

function formatDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parseDateInputValue(dateValue))
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
