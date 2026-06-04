import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  DoorOpen,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button, LinkButton } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { TableEmptyState, TableSkeletonRows } from '../../../components/ui/table-state'
import { supabase } from '../../../lib/supabase'
import type { QueueStatus, QueueTicketDetail, ScheduleAvailability } from '../../../types/queue'
import type { QueueEventFeedItem } from '../../../types/queue'
import { fetchDashboardData } from '../services/dashboard-service'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  })

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_tickets' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_sessions' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_events' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const data = dashboardQuery.data
  const tickets = useMemo(() => data?.tickets ?? [], [data?.tickets])
  const events = useMemo(() => data?.events ?? [], [data?.events])
  const schedules = useMemo(() => data?.schedules ?? [], [data?.schedules])

  const stats = useMemo(() => {
    const activeTickets = tickets.filter((ticket) =>
      ['waiting', 'called', 'serving', 'missed'].includes(ticket.status),
    )
    const completed = tickets.filter((ticket) => ticket.status === 'completed')
    const avgWait =
      tickets.length === 0
        ? 0
        : Math.round(
            tickets.reduce(
              (total, ticket) => total + ticket.estimated_wait_minutes,
              0,
            ) / tickets.length,
          )

    return {
      activeSchedules: schedules.filter((schedule) => schedule.status === 'open').length,
      activeTickets: activeTickets.length,
      avgWait,
      completionRate:
        tickets.length === 0 ? 0 : Math.round((completed.length / tickets.length) * 100),
      completed: completed.length,
      called: tickets.filter((ticket) => ticket.status === 'called').length,
      missed: tickets.filter((ticket) => ticket.status === 'missed').length,
      serving: tickets.filter((ticket) => ticket.status === 'serving').length,
      totalCapacity: schedules.reduce(
        (total, schedule) => total + schedule.quota_limit,
        0,
      ),
      totalTickets: tickets.length,
      waiting: tickets.filter((ticket) => ticket.status === 'waiting').length,
    }
  }, [schedules, tickets])

  const currentTicket = useMemo(
    () =>
      tickets.find((ticket) => ticket.status === 'serving') ??
      tickets.find((ticket) => ticket.status === 'called') ??
      null,
    [tickets],
  )

  const readiness = useMemo(() => {
    const activeDoctors =
      data?.doctors.filter((doctor) => doctor.is_active).length ?? 0
    const activePolyclinics =
      data?.polyclinics.filter((polyclinic) => polyclinic.is_active).length ?? 0

    if (activeDoctors === 0 || activePolyclinics === 0) {
      return {
        actionLabel: 'Lengkapi Data',
        actionTo: activeDoctors === 0 ? '/doctors' : '/polyclinics',
        description:
          'Data dokter atau poli aktif belum lengkap, sehingga jadwal operasional belum ideal.',
        icon: <AlertTriangle size={20} />,
        tone: 'warning' as const,
        title: 'Data operasional belum lengkap',
      }
    }

    if (schedules.length === 0) {
      return {
        actionLabel: 'Buat Jadwal',
        actionTo: '/schedules',
        description:
          'Belum ada jadwal untuk hari ini. Aplikasi pasien belum punya sesi antrean yang bisa dipilih.',
        icon: <CalendarClock size={20} />,
        tone: 'warning' as const,
        title: 'Belum ada jadwal hari ini',
      }
    }

    if (stats.activeSchedules === 0) {
      return {
        actionLabel: 'Kelola Jadwal',
        actionTo: '/schedules',
        description:
          'Jadwal hari ini ada, tetapi belum ada yang berstatus buka untuk menerima antrean.',
        icon: <DoorOpen size={20} />,
        tone: 'warning' as const,
        title: 'Tidak ada sesi yang buka',
      }
    }

    if (stats.totalTickets === 0) {
      return {
        actionLabel: 'Pantau Antrean',
        actionTo: '/queues',
        description:
          'Jadwal hari ini sudah siap. Antrean akan muncul saat pasien mengambil nomor dari aplikasi.',
        icon: <CheckCircle2 size={20} />,
        tone: 'success' as const,
        title: 'Operasional siap menerima pasien',
      }
    }

    return {
      actionLabel: 'Kelola Antrean',
      actionTo: '/queues',
      description: currentTicket
        ? `Nomor ${currentTicket.queue_code} sedang ${currentTicket.status === 'serving' ? 'dilayani' : 'dipanggil'} di ${currentTicket.polyclinic_name}.`
        : `${stats.waiting} pasien menunggu dan ${stats.completed} pasien sudah selesai.`,
      icon: <Activity size={20} />,
      tone: 'live' as const,
      title: 'Pelayanan sedang berjalan',
    }
  }, [
    currentTicket,
    data?.doctors,
    data?.polyclinics,
    schedules.length,
    stats.activeSchedules,
    stats.completed,
    stats.totalTickets,
    stats.waiting,
  ])

  const busiestPolyclinics = useMemo(() => {
    const counts = tickets.reduce<Record<string, number>>((accumulator, ticket) => {
      accumulator[ticket.polyclinic_name] =
        (accumulator[ticket.polyclinic_name] ?? 0) + 1
      return accumulator
    }, {})

    return Object.entries(counts)
      .map(([name, count]) => ({ count, name }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 4)
  }, [tickets])

  const operationalSessions = useMemo(
    () => buildOperationalSessions(schedules, tickets),
    [schedules, tickets],
  )
  const attentionSessions = operationalSessions.filter(
    (session) =>
      session.called > 0 ||
      session.serving > 0 ||
      session.waiting > 0 ||
      session.missed > 0,
  )
  const readyToRecall = operationalSessions.filter(
    (session) =>
      session.waiting === 0 &&
      session.missed > 0 &&
      session.called === 0 &&
      session.serving === 0 &&
      !session.isClosed &&
      session.phase !== 'before-start',
  ).length
  const drainingSessions = operationalSessions.filter(
    (session) =>
      session.phase === 'after-end' &&
      !session.isClosed &&
      session.activeTotal > 0,
  ).length

  const recentTickets = [...tickets]
    .sort((first, second) => {
      const priority: Record<QueueStatus, number> = {
        serving: 0,
        called: 1,
        missed: 2,
        waiting: 3,
        completed: 4,
        skipped: 5,
        cancelled: 6,
        expired: 7,
      }

      return priority[first.status] - priority[second.status]
    })
    .slice(0, 6)
  const upcomingSchedules = schedules.slice(0, 6)
  const capacityUsage =
    stats.totalCapacity === 0
      ? 0
      : Math.round((stats.totalTickets / stats.totalCapacity) * 100)
  const activityItems = events.slice(0, 5)

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <LinkButton to="/queues" variant="secondary">
                <Activity size={16} />
                Kelola Antrean
              </LinkButton>
              <LinkButton to="/schedules" variant="secondary">
                <CalendarClock size={16} />
                Kelola Jadwal
              </LinkButton>
              <Button
                variant="secondary"
                onClick={() => {
                  void dashboardQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </>
          }
          description="Pantau ritme operasional harian sebelum masuk ke antrean, jadwal, atau master data."
          eyebrow="Ringkasan Hari Ini"
          title="Dashboard Admin"
        />

        <ReadinessBanner readiness={readiness} />

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-black text-slate-950">
                  Prioritas Operasional
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Dahulukan sesi yang sedang melayani, punya pasien menunggu, atau perlu panggil ulang.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MiniSignal
                  icon={<Activity size={15} />}
                  label="Sesi perlu aksi"
                  value={attentionSessions.length}
                />
                <MiniSignal
                  icon={<RotateCcw size={15} />}
                  label="Siap panggil ulang"
                  value={readyToRecall}
                />
                <MiniSignal
                  icon={<Clock3 size={15} />}
                  label="Lewat jam"
                  value={drainingSessions}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 xl:grid-cols-3">
            {dashboardQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="h-56 animate-pulse rounded-xl bg-slate-100"
                  key={index}
                />
              ))
            ) : operationalSessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center xl:col-span-3">
                <p className="font-black text-slate-900">
                  Belum ada sesi operasional
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Buat jadwal hari ini agar sesi operasional tampil di sini.
                </p>
              </div>
            ) : (
              operationalSessions
                .slice(0, 6)
                .map((session) => (
                  <OperationalSessionCard
                    key={session.scheduleId}
                    session={session}
                  />
                ))
            )}
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            helper="Tiket yang masuk hari ini"
            icon={<UsersRound size={20} />}
            label="Total Pasien"
            tone="teal"
            value={stats.totalTickets}
          />
          <StatCard
            helper={`Menunggu, dipanggil, dilayani, terlewat (${stats.missed})`}
            icon={<Activity size={20} />}
            label="Antrean Aktif"
            tone="blue"
            value={stats.activeTickets}
          />
          <StatCard
            helper="Jadwal open hari ini"
            icon={<CalendarClock size={20} />}
            label="Jadwal Aktif"
            tone="amber"
            value={stats.activeSchedules}
          />
          <StatCard
            helper="Estimasi rata-rata"
            icon={<Clock3 size={20} />}
            label="Rata Tunggu"
            tone="emerald"
            value={`${stats.avgWait}m`}
          />
        </div>

        <Card className="overflow-hidden bg-slate-950 text-white">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-teal-300">
                Kondisi Antrean Saat Ini
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">
                {stats.activeTickets > 0
                  ? `${stats.activeTickets} antrean sedang berjalan`
                  : 'Belum ada antrean aktif'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                {currentTicket
                  ? `Fokus saat ini: ${currentTicket.queue_code} atas nama ${currentTicket.patient_name}.`
                  : 'Gunakan halaman antrean untuk memanggil pasien berikutnya dan menjaga perkiraan waktu tetap akurat.'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <LiveTile label="Aktif" value={stats.activeTickets} />
              <LiveTile label="Menunggu" value={stats.waiting} />
              <LiveTile label="Sedang" value={currentTicket?.queue_code ?? '-'} />
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <InsightCard
            helper={`${stats.completed} dari ${stats.totalTickets} tiket hari ini`}
            label="Completion Rate"
            value={`${stats.completionRate}%`}
          />
          <InsightCard
            helper={`${stats.totalTickets} dari ${stats.totalCapacity} kuota terpakai`}
            label="Pemakaian Kapasitas"
            value={`${capacityUsage}%`}
          />
          <InsightCard
            helper="Berbasis estimasi tiket aktif dan selesai"
            label="Rata-rata Tunggu"
            value={`${stats.avgWait} menit`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black">Antrean Terbaru</h3>
                <Link className="text-sm font-black text-teal-700" to="/queues">
                  Lihat antrean
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nomor</th>
                    <th className="px-4 py-3">Pasien</th>
                    <th className="px-4 py-3">Poli</th>
                    <th className="px-4 py-3">Estimasi</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardQuery.isLoading ? (
                    <TableSkeletonRows columns={5} />
                  ) : recentTickets.length === 0 ? (
                    <TableEmptyState
                      colSpan={5}
                      description="Antrean akan muncul otomatis saat pasien mengambil nomor dari aplikasi."
                      title="Belum ada antrean hari ini"
                    />
                  ) : (
                    recentTickets.map((ticket) => (
                      <tr className="transition hover:bg-slate-50/80" key={ticket.ticket_id}>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-teal-50 px-3 py-1 font-black text-teal-700">
                            {ticket.queue_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {ticket.patient_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {ticket.polyclinic_name}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {ticket.estimated_wait_minutes} menit
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ticket.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-black">Aktivitas Terbaru</h3>
                <ClipboardList className="text-teal-600" size={20} />
              </div>
              <div className="space-y-3">
                {dashboardQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      className="h-12 animate-pulse rounded-xl bg-slate-100"
                      key={index}
                    />
                  ))
                ) : activityItems.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-500">
                    Belum ada aktivitas antrean hari ini.
                  </p>
                ) : (
                  activityItems.map((event) => (
                    <ActivityItem event={event} key={event.event_id} />
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-black">Kesiapan Data</h3>
                <CheckCircle2 className="text-emerald-600" size={20} />
              </div>
              <div className="grid gap-3">
                <ReadinessRow
                  label="Dokter aktif"
                  value={data?.doctors.filter((doctor) => doctor.is_active).length ?? 0}
                />
                <ReadinessRow
                  label="Poli aktif"
                  value={
                    data?.polyclinics.filter((polyclinic) => polyclinic.is_active)
                      .length ?? 0
                  }
                />
                <ReadinessRow label="Selesai hari ini" value={stats.completed} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-black">Poli Teramai</h3>
                <Stethoscope className="text-teal-600" size={20} />
              </div>
              <div className="space-y-3">
                {busiestPolyclinics.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada data pasien.</p>
                ) : (
                  busiestPolyclinics.map((polyclinic) => (
                    <div
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      key={polyclinic.name}
                    >
                      <span className="font-bold text-slate-700">
                        {polyclinic.name}
                      </span>
                      <span className="font-black text-teal-700">
                        {polyclinic.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black">Jadwal Hari Ini</h3>
              <Link className="text-sm font-black text-teal-700" to="/schedules">
                Kelola jadwal
              </Link>
            </div>
          </div>
          <div className="grid gap-0 divide-y divide-slate-100">
            {dashboardQuery.isLoading ? (
              <div className="grid gap-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                    key={index}
                  />
                ))}
              </div>
            ) : upcomingSchedules.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Belum ada jadwal hari ini.
              </div>
            ) : (
              upcomingSchedules.map((schedule) => (
                <ScheduleRow key={schedule.schedule_id} schedule={schedule} />
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}

function ScheduleRow({ schedule }: { schedule: ScheduleAvailability }) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.2fr_1fr_160px_120px] md:items-center">
      <div>
        <p className="font-black text-slate-900">{schedule.polyclinic_name}</p>
        <p className="text-sm text-slate-500">{schedule.doctor_name}</p>
      </div>
      <p className="text-sm font-bold text-slate-700">
        {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
      </p>
      <p className="text-sm text-slate-500">
        {schedule.total_taken}/{schedule.quota_limit} pasien
      </p>
      <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
        {schedule.status}
      </span>
    </div>
  )
}

type ReadinessBannerProps = {
  readiness: {
    actionLabel: string
    actionTo: string
    description: string
    icon: ReactNode
    tone: 'live' | 'success' | 'warning'
    title: string
  }
}

function ReadinessBanner({ readiness }: ReadinessBannerProps) {
  const tone =
    readiness.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : readiness.tone === 'live'
        ? 'border-teal-200 bg-teal-50 text-teal-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <Card className={`border p-4 ${tone}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
            {readiness.icon}
          </div>
          <div>
            <h3 className="font-black">{readiness.title}</h3>
            <p className="mt-1 text-sm font-semibold leading-6 opacity-80">
              {readiness.description}
            </p>
          </div>
        </div>
        <LinkButton to={readiness.actionTo} variant="secondary">
          {readiness.actionLabel}
        </LinkButton>
      </div>
    </Card>
  )
}

function LiveTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3 text-center">
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function InsightCard({
  helper,
  label,
  value,
}: {
  helper: string
  label: string
  value: string
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </Card>
  )
}

function ActivityItem({ event }: { event: QueueEventFeedItem }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-slate-900">{event.queue_code}</p>
        <StatusBadge status={event.new_status} />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-600">
        {event.patient_name} - {event.polyclinic_name}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {event.message ?? 'Status antrean diperbarui'} -{' '}
        {new Date(event.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  )
}

type SessionPhase = 'before-start' | 'operational' | 'after-end'

type OperationalSession = {
  actionLabel: string
  actionTone: 'critical' | 'live' | 'recall' | 'quiet' | 'success' | 'warning'
  activeTotal: number
  availabilityReason: string
  branchName: string
  called: number
  cancelled: number
  completed: number
  currentPatient: string | null
  currentCode: string | null
  currentStatus: QueueStatus | null
  doctorName: string
  expired: number
  isClosed: boolean
  isTakeable: boolean
  missed: number
  phase: SessionPhase
  polyclinicName: string
  quotaLimit: number
  queueSessionId: string | null
  remainingQuota: number
  scheduleId: string
  serving: number
  skipped: number
  timeLabel: string
  totalTaken: number
  waiting: number
}

function buildOperationalSessions(
  schedules: ScheduleAvailability[],
  tickets: QueueTicketDetail[],
) {
  return schedules
    .map((schedule): OperationalSession => {
      const sessionTickets = tickets.filter(
        (ticket) => ticket.queue_session_id === schedule.queue_session_id,
      )
      const counts = countStatuses(sessionTickets)
      const current =
        sessionTickets.find((ticket) => ticket.status === 'serving') ??
        sessionTickets.find((ticket) => ticket.status === 'called') ??
        null
      const phase = getSchedulePhase(
        schedule.schedule_date,
        schedule.start_time,
        schedule.end_time,
      )
      const isClosed =
        schedule.status === 'closed' ||
        schedule.status === 'cancelled' ||
        schedule.availability_reason === 'Sesi antrean ditutup'
      const activeTotal =
        counts.waiting + counts.called + counts.serving + counts.missed
      const action = getOperationalAction({
        activeTotal,
        called: counts.called,
        isClosed,
        missed: counts.missed,
        phase,
        serving: counts.serving,
        totalTaken: schedule.total_taken,
        waiting: counts.waiting,
      })

      return {
        actionLabel: action.label,
        actionTone: action.tone,
        activeTotal,
        availabilityReason: schedule.availability_reason,
        branchName: schedule.branch_name,
        called: counts.called,
        cancelled: counts.cancelled,
        completed: counts.completed,
        currentCode: current?.queue_code ?? null,
        currentPatient: current?.patient_name ?? null,
        currentStatus: current?.status ?? null,
        doctorName: schedule.doctor_name,
        expired: counts.expired,
        isClosed,
        isTakeable: schedule.is_takeable,
        missed: counts.missed,
        phase,
        polyclinicName: schedule.polyclinic_name,
        quotaLimit: schedule.quota_limit,
        queueSessionId: schedule.queue_session_id,
        remainingQuota: schedule.remaining_quota,
        scheduleId: schedule.schedule_id,
        serving: counts.serving,
        skipped: counts.skipped,
        timeLabel: `${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`,
        totalTaken: schedule.total_taken,
        waiting: counts.waiting,
      }
    })
    .sort(sortOperationalSessions)
}

function OperationalSessionCard({ session }: { session: OperationalSession }) {
  const badge = getSessionBadge(session)
  const accent =
    session.actionTone === 'critical'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : session.actionTone === 'recall'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : session.actionTone === 'live'
          ? 'border-teal-200 bg-teal-50 text-teal-700'
          : session.actionTone === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : session.actionTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-teal-700">
            {session.branchName}
          </p>
          <h4 className="mt-1 font-black text-slate-950">
            {session.polyclinicName}
          </h4>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
            {session.doctorName} - {session.timeLabel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${badge.tone}`}
        >
          {badge.label}
        </span>
      </div>

      <div className={`mt-4 rounded-2xl border px-3 py-3 ${accent}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase opacity-75">
              Fokus Operasional
            </p>
            <p className="mt-1 text-sm font-black">
              {session.currentCode
                ? `${session.currentCode} - ${session.currentPatient}`
                : session.actionLabel}
            </p>
          </div>
          {session.actionTone === 'recall' ? (
            <RotateCcw size={20} />
          ) : session.actionTone === 'success' ? (
            <CheckCircle2 size={20} />
          ) : (
            <ListChecks size={20} />
          )}
        </div>
        {session.phase === 'after-end' && session.activeTotal > 0 ? (
          <p className="mt-2 text-xs font-bold opacity-80">
            Lewat jam operasional, admin tetap bisa menghabiskan antrean yang
            sudah terlanjur masuk.
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SessionMetric label="Menunggu" value={session.waiting} />
        <SessionMetric label="Terlewat" value={session.missed} />
        <SessionMetric
          label="Aktif"
          value={session.called + session.serving}
        />
        <SessionMetric
          label="Kuota"
          value={`${session.remainingQuota}/${session.quotaLimit}`}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold leading-5 text-slate-500">
          Final: {session.completed} selesai, {session.skipped} dilewati,{' '}
          {session.cancelled + session.expired} batal/kedaluwarsa
        </p>
        <LinkButton className="shrink-0" to="/queues" variant="secondary">
          <Activity size={15} />
          Kelola
        </LinkButton>
      </div>
    </div>
  )
}

function MiniSignal({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm shadow-slate-900/5">
      <span className="text-teal-700">{icon}</span>
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  )
}

function SessionMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  )
}

function ReadinessRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className="text-lg font-black text-slate-950">{value}</span>
    </div>
  )
}

function countStatuses(tickets: QueueTicketDetail[]) {
  const initial: Record<QueueStatus, number> = {
    cancelled: 0,
    called: 0,
    completed: 0,
    expired: 0,
    missed: 0,
    serving: 0,
    skipped: 0,
    waiting: 0,
  }

  return tickets.reduce((counts, ticket) => {
    counts[ticket.status] += 1
    return counts
  }, initial)
}

function getSchedulePhase(
  scheduleDate: string,
  startTime: string,
  endTime: string,
): SessionPhase {
  const now = new Date()
  const start = new Date(`${scheduleDate}T${startTime}`)
  const end = new Date(`${scheduleDate}T${endTime}`)

  if (now < start) return 'before-start'
  if (now >= end) return 'after-end'
  return 'operational'
}

function getOperationalAction({
  activeTotal,
  called,
  isClosed,
  missed,
  phase,
  serving,
  totalTaken,
  waiting,
}: {
  activeTotal: number
  called: number
  isClosed: boolean
  missed: number
  phase: SessionPhase
  serving: number
  totalTaken: number
  waiting: number
}) {
  if (isClosed) return { label: 'Sesi ditutup', tone: 'quiet' as const }
  if (called > 0 || serving > 0) {
    return { label: 'Selesaikan pasien aktif', tone: 'live' as const }
  }
  if (waiting > 0 && phase === 'before-start') {
    return { label: 'Menunggu jam buka', tone: 'warning' as const }
  }
  if (waiting > 0) return { label: 'Panggil berikutnya', tone: 'critical' as const }
  if (missed > 0) return { label: 'Panggil ulang terlewat', tone: 'recall' as const }
  if (activeTotal === 0 && totalTaken > 0) {
    return { label: 'Siap tutup sesi', tone: 'success' as const }
  }
  return { label: 'Menunggu pasien', tone: 'quiet' as const }
}

function sortOperationalSessions(first: OperationalSession, second: OperationalSession) {
  const firstPriority = getOperationalPriority(first)
  const secondPriority = getOperationalPriority(second)

  if (firstPriority !== secondPriority) return firstPriority - secondPriority
  return first.timeLabel.localeCompare(second.timeLabel)
}

function getOperationalPriority(session: OperationalSession) {
  if (session.called > 0 || session.serving > 0) return 0
  if (session.waiting > 0 && session.phase !== 'before-start') return 1
  if (session.waiting === 0 && session.missed > 0 && !session.isClosed) return 2
  if (session.phase === 'after-end' && session.activeTotal > 0) return 3
  if (session.waiting > 0) return 4
  if (!session.isClosed && session.totalTaken > 0) return 5
  if (!session.isClosed) return 6
  return 7
}

function getSessionBadge(session: OperationalSession) {
  if (session.isClosed) {
    return {
      label: 'Ditutup',
      tone: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }
  if (session.phase === 'before-start') {
    return {
      label: 'Belum mulai',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }
  if (session.phase === 'after-end' && session.activeTotal > 0) {
    return {
      label: 'Draining',
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
    }
  }
  if (session.called > 0 || session.serving > 0) {
    return {
      label: 'Sedang aktif',
      tone: 'border-teal-200 bg-teal-50 text-teal-700',
    }
  }
  if (session.waiting > 0) {
    return {
      label: 'Ada pasien menunggu',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }
  if (session.missed > 0) {
    return {
      label: 'Perlu panggil ulang',
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
    }
  }
  return {
    label: session.isTakeable ? 'Menerima pasien' : 'Siaga',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
}

function StatusBadge({ status }: { status: QueueTicketDetail['status'] }) {
  const labels: Record<QueueStatus, string> = {
    cancelled: 'Dibatalkan',
    called: 'Dipanggil',
    completed: 'Selesai',
    expired: 'Kedaluwarsa',
    missed: 'Terlewat',
    serving: 'Dilayani',
    skipped: 'Dilewati',
    waiting: 'Menunggu',
  }
  const tone =
    status === 'waiting'
      ? 'bg-blue-50 text-blue-700'
      : status === 'called'
        ? 'bg-amber-50 text-amber-700'
        : status === 'serving'
          ? 'bg-teal-50 text-teal-700'
          : status === 'missed'
            ? 'bg-violet-50 text-violet-700'
          : status === 'completed'
            ? 'bg-emerald-50 text-emerald-700'
            : status === 'cancelled'
              ? 'bg-rose-50 text-rose-700'
              : status === 'skipped'
                ? 'bg-orange-50 text-orange-700'
                : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}
