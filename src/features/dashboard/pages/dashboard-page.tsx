import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button, LinkButton } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import type { QueueStatus, QueueTicketDetail, ScheduleAvailability } from '../../../types/queue'
import { fetchDashboardData } from '../services/dashboard-service'

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  })

  const data = dashboardQuery.data
  const tickets = useMemo(() => data?.tickets ?? [], [data?.tickets])
  const schedules = useMemo(() => data?.schedules ?? [], [data?.schedules])

  const stats = useMemo(() => {
    const activeTickets = tickets.filter((ticket) =>
      ['waiting', 'called', 'serving'].includes(ticket.status),
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
      completed: completed.length,
      totalTickets: tickets.length,
    }
  }, [schedules, tickets])

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

  const recentTickets = tickets.slice(0, 6)
  const upcomingSchedules = schedules.slice(0, 5)

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
          eyebrow="Operational Overview"
          title="Dashboard Admin"
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            helper="Tiket yang masuk hari ini"
            icon={<UsersRound size={20} />}
            label="Total Pasien"
            tone="teal"
            value={stats.totalTickets}
          />
          <StatCard
            helper="Waiting, called, serving"
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
                Live Operational Snapshot
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">
                {stats.activeTickets > 0
                  ? `${stats.activeTickets} antrean sedang berjalan`
                  : 'Belum ada antrean aktif'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                Gunakan halaman antrean untuk memanggil pasien berikutnya dan
                menjaga estimasi waktu tetap sinkron dengan aplikasi pasien.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <LiveTile label="Aktif" value={stats.activeTickets} />
              <LiveTile label="Selesai" value={stats.completed} />
              <LiveTile label="Tunggu" value={`${stats.avgWait}m`} />
            </div>
          </div>
        </Card>

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
                    <EmptyRow colSpan={5} text="Memuat antrean..." />
                  ) : recentTickets.length === 0 ? (
                    <EmptyRow colSpan={5} text="Belum ada antrean hari ini." />
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
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Memuat jadwal...
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

function LiveTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3 text-center">
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
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

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-slate-500" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  )
}

function StatusBadge({ status }: { status: QueueTicketDetail['status'] }) {
  const labels: Record<QueueStatus, string> = {
    cancelled: 'Batal',
    called: 'Dipanggil',
    completed: 'Selesai',
    expired: 'Kedaluwarsa',
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
          : status === 'completed'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}
