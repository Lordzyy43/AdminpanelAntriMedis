import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Clock3, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../../../components/ui/button'
import { supabase } from '../../../lib/supabase'
import type {
  Polyclinic,
  QueueStatus,
  QueueTicketDetail,
  ScheduleAvailability,
} from '../../../types/queue'
import { fetchPolyclinics, fetchQueueTickets, fetchSchedules } from '../services/queue-service'

const today = toDateInputValue(new Date())
const storageKey = 'queue-display-polyclinic-id'

export function QueueDisplayPage() {
  const queryClient = useQueryClient()
  const [selectedPolyclinicId, setSelectedPolyclinicId] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const polyclinicsQuery = useQuery({
    queryKey: ['queue-display-polyclinics'],
    queryFn: fetchPolyclinics,
  })
  const schedulesQuery = useQuery({
    queryKey: ['queue-display-schedules', today],
    queryFn: () => fetchSchedules(today),
  })

  const polyclinics = useMemo(
    () => polyclinicsQuery.data ?? [],
    [polyclinicsQuery.data],
  )
  const schedules = useMemo(
    () => schedulesQuery.data ?? [],
    [schedulesQuery.data],
  )
  const selectedPolyclinic = useMemo(
    (): Polyclinic | null =>
      polyclinics.find((polyclinic) => polyclinic.id === selectedPolyclinicId) ?? null,
    [polyclinics, selectedPolyclinicId],
  )
  const activeSchedule = useMemo(
    () => pickDisplaySchedule(schedules, selectedPolyclinicId),
    [schedules, selectedPolyclinicId],
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
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(storageKey)
    if (saved && !selectedPolyclinicId) {
      setSelectedPolyclinicId(saved)
    }
  }, [selectedPolyclinicId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedPolyclinicId) {
      window.localStorage.setItem(storageKey, selectedPolyclinicId)
    }
  }, [selectedPolyclinicId])

  useEffect(() => {
    if (selectedPolyclinicId || polyclinics.length === 0) return
    const defaultPolyclinic =
      polyclinics.find((polyclinic) => polyclinic.is_active) ?? polyclinics[0]
    if (defaultPolyclinic) {
      setSelectedPolyclinicId(defaultPolyclinic.id)
    }
  }, [polyclinics, selectedPolyclinicId])

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

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

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await document.documentElement.requestFullscreen()
    } catch {
      // Browser fullscreen can be blocked by policy; the display still works in windowed mode.
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
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
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-black uppercase text-slate-300">
                Poli Display
              </p>
              <select
                className="mt-1 w-[240px] rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
                value={selectedPolyclinicId}
                onChange={(event) => setSelectedPolyclinicId(event.target.value)}
              >
                <option value="">Pilih poli</option>
                {polyclinics.map((polyclinic) => (
                  <option key={polyclinic.id} value={polyclinic.id}>
                    {polyclinic.name}
                    {polyclinic.is_active ? '' : ' (nonaktif)'}
                  </option>
                ))}
              </select>
            </div>
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
            <Button
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk ke layar penuh'}
              title={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk ke layar penuh'}
              variant="secondary"
              onClick={() => {
                void toggleFullscreen()
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
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
                {selectedPolyclinic?.name ?? activeSchedule?.polyclinic_name ?? 'Belum ada sesi'}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {selectedPolyclinic
                  ? selectedPolyclinic.is_active
                    ? 'Aktif'
                    : 'Tidak aktif'
                  : 'Belum dipilih'}
              </p>
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
                  : schedulesQuery.isLoading || ticketsQuery.isLoading || polyclinicsQuery.isLoading
                    ? 'Memuat data'
                    : activeSchedule
                      ? 'Menunggu pemanggilan'
                      : 'Belum ada sesi untuk poli ini'}
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

function pickDisplaySchedule(
  schedules: ScheduleAvailability[],
  polyclinicId: string,
) {
  const scopedSchedules = polyclinicId
    ? schedules.filter((schedule) => schedule.polyclinic_id === polyclinicId)
    : schedules

  return (
    scopedSchedules.find(
      (schedule) => schedule.queue_session_id && schedule.current_number > 0,
    ) ?? scopedSchedules.find((schedule) => schedule.queue_session_id) ?? null
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
