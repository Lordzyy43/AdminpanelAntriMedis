import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Clock3,
  Eye,
  FilterX,
  Loader2,
  Megaphone,
  OctagonX,
  Power,
  RefreshCw,
  Search,
  RotateCcw,
  SkipForward,
  Stethoscope,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { FeedbackBanner } from '../../../components/ui/feedback-banner'
import { FormDrawer } from '../../../components/ui/form-drawer'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { Pagination } from '../../../components/ui/pagination'
import { TableEmptyState, TableSkeletonRows } from '../../../components/ui/table-state'
import { useToast } from '../../../components/ui/use-toast'
import { friendlySupabaseError } from '../../../lib/friendly-error'
import { paginateItems } from '../../../lib/pagination'
import { supabase } from '../../../lib/supabase'
import { playQueueCallAudio, primeQueueCallAudio } from '../../../lib/queue-call-audio'
import type {
  QueueStatus,
  ScheduleAvailability,
  QueueTicketDetail,
  QueueTicketTimelineItem,
} from '../../../types/queue'
import {
  callNextQueue,
  closeQueueSession,
  type CloseQueueSessionResult,
  fetchQueueTickets,
  fetchQueueTicketTimeline,
  fetchSchedules,
  recallMissedQueue,
  updateQueueStatus,
} from '../services/queue-service'

const activeStatuses = ['waiting', 'called', 'serving', 'missed'] as const
const pageSize = 8
const today = toDateInputValue(new Date())
const queueStatusOptions: Array<{ label: string; value: QueueStatus | 'all' }> = [
  { label: 'Semua status', value: 'all' },
  { label: 'Menunggu', value: 'waiting' },
  { label: 'Dipanggil', value: 'called' },
  { label: 'Dilayani', value: 'serving' },
  { label: 'Terlewat', value: 'missed' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Dilewati', value: 'skipped' },
  { label: 'Batal', value: 'cancelled' },
  { label: 'Kedaluwarsa', value: 'expired' },
]

type PendingQueueAction =
  | {
      type: 'call-next'
    }
  | {
      type: 'recall-missed'
    }
  | {
      type: 'close-session'
      waitingCount: number
    }
  | {
      status: QueueStatus
      ticket: QueueTicketDetail
      type: 'update-status'
    }

function isActiveStatus(status: QueueStatus) {
  return activeStatuses.some((activeStatus) => activeStatus === status)
}

export function QueueManagementPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionParam = searchParams.get('session')
  const ticketParam = searchParams.get('ticket')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [detailTicket, setDetailTicket] = useState<QueueTicketDetail | null>(null)
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingQueueAction | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionReasonError, setActionReasonError] = useState<string | null>(null)
  const [polyclinicFilter, setPolyclinicFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all')

  const schedulesQuery = useQuery({
    queryKey: ['schedules', today],
    queryFn: () => fetchSchedules(today),
  })

  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data])

  useEffect(() => {
    if (!sessionParam) return
    setSelectedSessionId(sessionParam)
  }, [sessionParam])

  const polyclinicOptions = useMemo(
    () =>
      Array.from(
        new Map(
          schedules.map((schedule) => [
            schedule.polyclinic_id,
            schedule.polyclinic_name,
          ]),
        ),
      ),
    [schedules],
  )
  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        const matchesPolyclinic =
          polyclinicFilter === 'all' || schedule.polyclinic_id === polyclinicFilter

        return matchesPolyclinic
      }),
    [polyclinicFilter, schedules],
  )
  const activeSessionId =
    selectedSessionId &&
    filteredSchedules.some((schedule) => schedule.queue_session_id === selectedSessionId)
      ? selectedSessionId
      : filteredSchedules[0]?.queue_session_id ?? null

  const selectedSchedule = filteredSchedules.find(
    (schedule) => schedule.queue_session_id === activeSessionId,
  )

  const ticketsQuery = useQuery({
    queryKey: ['queue-tickets', activeSessionId],
    queryFn: () => fetchQueueTickets(activeSessionId!),
    enabled: Boolean(activeSessionId),
  })

  useEffect(() => {
    if (!activeSessionId) return

    const channel = supabase
      .channel(`admin-queue-${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_tickets',
          filter: `queue_session_id=eq.${activeSessionId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['queue-tickets', activeSessionId],
          })
          void queryClient.invalidateQueries({ queryKey: ['schedules'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeSessionId, queryClient])

  useEffect(() => {
    const channel = supabase
      .channel('admin-queue-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_sessions',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['schedules'] })
          if (activeSessionId) {
            void queryClient.invalidateQueries({
              queryKey: ['queue-tickets', activeSessionId],
            })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeSessionId, queryClient])

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data])
  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter
      const searchableText = [
        ticket.queue_code,
        ticket.patient_name,
        ticket.polyclinic_name,
        ticket.doctor_name,
      ]
        .join(' ')
        .toLowerCase()

      return matchesStatus && searchableText.includes(normalizedSearch)
    })
  }, [searchTerm, statusFilter, tickets])
  const paginatedTickets = useMemo(
    () => paginateItems(filteredTickets, page, pageSize),
    [filteredTickets, page],
  )

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      waiting: tickets.filter((ticket) => ticket.status === 'waiting').length,
      missed: tickets.filter((ticket) => ticket.status === 'missed').length,
      active: tickets.filter((ticket) => isActiveStatus(ticket.status)).length,
      completed: tickets.filter((ticket) => ticket.status === 'completed').length,
      skipped: tickets.filter((ticket) => ticket.status === 'skipped').length,
      cancelled: tickets.filter((ticket) => ticket.status === 'cancelled').length,
      expired: tickets.filter((ticket) => ticket.status === 'expired').length,
    }
  }, [tickets])
  const finalTickets = useMemo(
    () => tickets.filter((ticket) => !isActiveStatus(ticket.status)),
    [tickets],
  )
  const hasUnresolvedCall = tickets.some((ticket) =>
    ticket.status === 'called' || ticket.status === 'serving',
  )
  const currentTicket = tickets.find(
    (ticket) => ticket.status === 'called' || ticket.status === 'serving',
  )
  const schedulePhase = selectedSchedule ? getSchedulePhase(selectedSchedule) : 'none'
  const isSessionClosed =
    selectedSchedule?.availability_reason === 'Sesi antrean ditutup'
  const cannotCallBecauseSchedule = schedulePhase === 'before-start'
  const canCallNext =
    Boolean(activeSessionId) &&
    !hasUnresolvedCall &&
    !isSessionClosed &&
    !cannotCallBecauseSchedule &&
    stats.waiting > 0
  const canRecallMissed =
    Boolean(activeSessionId) &&
    !isSessionClosed &&
    !currentTicket &&
    stats.waiting === 0 &&
    stats.missed > 0 &&
    schedulePhase !== 'before-start'
  const canCloseSession =
    Boolean(activeSessionId) &&
    !isSessionClosed &&
    !hasUnresolvedCall
  const callNextMutation = useMutation({
    mutationFn: () => callNextQueue(activeSessionId!),
    onSuccess: async () => {
      notify({
        message: 'Pasien berikutnya berhasil dipanggil.',
        title: 'Antrean diperbarui',
        tone: 'success',
      })
      const played = await playQueueCallAudio()
      if (!played) {
        notify({
          message:
            'Audio panggilan tidak dapat diputar di browser ini. Gunakan volume perangkat atau mode display sebagai cadangan.',
          title: 'Audio panggilan tidak tersedia',
          tone: 'warning',
        })
      }
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Aksi gagal',
        tone: 'danger',
      })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      message,
      ticketId,
      status,
    }: {
      message?: string
      ticketId: string
      status: QueueStatus
    }) => updateQueueStatus(ticketId, status, message),
    onSuccess: () => {
      notify({
        message: 'Status antrean berhasil diperbarui.',
        title: 'Antrean diperbarui',
        tone: 'success',
      })
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Aksi gagal',
        tone: 'danger',
      })
    },
  })

  const recallMissedMutation = useMutation({
    mutationFn: () => recallMissedQueue(activeSessionId!),
    onSuccess: () => {
      notify({
        message: 'Pasien terlewat berhasil dipanggil ulang.',
        title: 'Antrean diperbarui',
        tone: 'success',
      })
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Panggil ulang gagal',
        tone: 'danger',
      })
    },
  })

  const closeSessionMutation = useMutation({
    mutationFn: () => closeQueueSession(activeSessionId!),
    onSuccess: (result) => {
      notify({
        message: closeSessionSuccessMessage(result),
        title: 'Sesi antrean ditutup',
        tone: 'success',
      })
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Gagal menutup sesi',
        tone: 'danger',
      })
    },
  })

  const confirmState = buildConfirmState(pendingAction)
  const actionError =
    callNextMutation.error ??
    recallMissedMutation.error ??
    updateStatusMutation.error ??
    closeSessionMutation.error

  useEffect(() => {
    if (!ticketParam) return
    const matchedTicket = tickets.find((ticket) => ticket.ticket_id === ticketParam)
    if (matchedTicket) {
      setDetailTicket(matchedTicket)
    }
  }, [ticketParam, tickets])

  function confirmPendingAction() {
    if (!pendingAction) return

    if (pendingAction.type === 'call-next') {
      void primeQueueCallAudio()
      callNextMutation.mutate()
      return
    }

    if (pendingAction.type === 'recall-missed') {
      recallMissedMutation.mutate()
      return
    }

    if (pendingAction.type === 'close-session') {
      closeSessionMutation.mutate()
      return
    }

    if (requiresReason(pendingAction.status) && actionReason.trim().length < 5) {
      setActionReasonError('Tulis alasan minimal 5 karakter agar histori pasien jelas.')
      return
    }

    updateStatusMutation.mutate({
      message: actionReason.trim() || undefined,
      status: pendingAction.status,
      ticketId: pendingAction.ticket.ticket_id,
    })
  }

  function openPendingAction(action: PendingQueueAction) {
    setPendingAction(action)
    setActionReason('')
    setActionReasonError(null)
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          description="Panggil, layani, dan selesaikan antrean pasien dengan urutan yang jelas."
          eyebrow="Kontrol Antrean"
          title="Antrean Hari Ini"
        />

        {actionError ? (
          <FeedbackBanner title="Aksi antrean gagal diproses" tone="danger">
            {friendlySupabaseError(
              actionError,
              'Coba refresh data antrean lalu ulangi aksi.',
            )}
          </FeedbackBanner>
        ) : null}

        <Card className="sticky top-[88px] z-[5] border-slate-200/80 bg-white/95 p-4 shadow-lg shadow-slate-900/5 backdrop-blur">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-teal-700">
                Kontrol Antrean
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                {selectedSchedule?.polyclinic_name ?? 'Belum ada sesi dipilih'}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {filteredSchedules.length} sesi hari ini, {formatDateLabel(today)}.
                {currentTicket
                  ? ` Nomor ${currentTicket.queue_code} sedang ${currentTicket.status === 'serving' ? 'dilayani' : 'dipanggil'}.`
                  : ' Tidak ada nomor yang sedang dipanggil.'}
              </p>
              <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
                <ControlMetric label="Total" value={stats.total} />
                <ControlMetric label="Menunggu" value={stats.waiting} />
                <ControlMetric label="Aktif" value={stats.active} />
                <ControlMetric label="Selesai" value={stats.completed} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Button
                disabled={!canCallNext || callNextMutation.isPending}
                onClick={() => {
                  void primeQueueCallAudio()
                  openPendingAction({ type: 'call-next' })
                }}
              >
                {callNextMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Megaphone size={16} />
                )}
                Panggil Berikutnya
              </Button>
              <Button
                disabled={!canRecallMissed || recallMissedMutation.isPending}
                variant="secondary"
                onClick={() => openPendingAction({ type: 'recall-missed' })}
              >
                {recallMissedMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                Panggil Ulang
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void ticketsQuery.refetch()
                  void schedulesQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPolyclinicFilter('all')
                  setSearchTerm('')
                  setStatusFilter('all')
                  setSelectedSessionId(null)
                  setPage(1)
                }}
              >
                <FilterX size={16} />
                Reset
              </Button>
              <Button
                disabled={!canCloseSession || closeSessionMutation.isPending}
                variant="danger"
                onClick={() =>
                  openPendingAction({
                    type: 'close-session',
                    waitingCount: stats.waiting,
                  })
                }
              >
                {closeSessionMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Power size={16} />
                )}
                Tutup Sesi
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-3">
          <QueueStatusSection
            description="Tiket yang sudah selesai, dilewati, atau dibatalkan."
            emptyLabel="Belum ada riwayat final"
            tickets={finalTickets}
            title="Riwayat Hari Ini"
          />
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px] xl:items-start">
            <div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-black uppercase tracking-wide text-teal-700">
                  Sesi Aktif
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  Pilih poli dan jadwal dokter
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  Klik label poli untuk melihat sesi praktik aktif hari ini.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={[
                    'rounded-full border px-4 py-2 text-sm font-black transition',
                    polyclinicFilter === 'all'
                      ? 'border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-900/15'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700',
                  ].join(' ')}
                  type="button"
                  onClick={() => {
                    setPolyclinicFilter('all')
                    setSelectedSessionId(null)
                    setPage(1)
                  }}
                >
                  Semua Poli
                </button>
                {polyclinicOptions.map(([id, name]) => (
                  <button
                    className={[
                      'rounded-full border px-4 py-2 text-sm font-black transition',
                      polyclinicFilter === id
                        ? 'border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-900/15'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700',
                    ].join(' ')}
                    key={id}
                    type="button"
                    onClick={() => {
                      setPolyclinicFilter(id)
                      setSelectedSessionId(null)
                      setPage(1)
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredSchedules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm font-bold text-slate-500 md:col-span-2">
                    Tidak ada jadwal dokter aktif untuk pilihan ini.
                  </div>
                ) : (
                  filteredSchedules.map((schedule) => {
                    const isSelected = schedule.queue_session_id === activeSessionId

                    return (
                      <button
                        className={[
                          'rounded-lg border p-3 text-left transition',
                          isSelected
                            ? 'border-teal-500 bg-teal-50 shadow-sm shadow-teal-900/10'
                            : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50',
                        ].join(' ')}
                        key={schedule.schedule_id}
                        type="button"
                        onClick={() => {
                          setSelectedSessionId(schedule.queue_session_id)
                          setPage(1)
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-950">
                              {schedule.polyclinic_name}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">
                              {schedule.doctor_name}
                            </p>
                          </div>
                          <span
                            className={[
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                              isSelected
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-600',
                            ].join(' ')}
                          >
                            {isSelected ? 'Dipilih' : 'Pilih'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold text-slate-500">
                          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                            {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                          </span>
                          
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {selectedSchedule?.polyclinic_name ?? 'Belum ada sesi'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {selectedSchedule
                      ? `${selectedSchedule.branch_name} - ${selectedSchedule.start_time.slice(0, 5)}-${selectedSchedule.end_time.slice(0, 5)}`
                      : 'Buka jadwal praktik terlebih dahulu.'}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <Stethoscope size={20} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniSessionStat
                  label="Kuota sisa"
                  value={
                    selectedSchedule
                      ? `${selectedSchedule.remaining_quota}/${selectedSchedule.quota_limit}`
                      : '-'
                  }
                />
                <MiniSessionStat
                  label="Nomor terakhir"
                  value={selectedSchedule?.last_number ?? '-'}
                />
                <MiniSessionStat label="Sedang aktif" value={currentTicket?.queue_code ?? '-'} />
                <MiniSessionStat label="Menunggu" value={stats.waiting} />
                <MiniSessionStat label="Terlewat" value={stats.missed} />
                <MiniSessionStat
                  label="Status sesi"
                  value={sessionPhaseLabel(schedulePhase, isSessionClosed)}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                  <h3 className="font-black">Daftar Pasien</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {filteredTickets.length} dari {tickets.length} tiket.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,280px)_180px]">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={17}
                  />
                  <Input
                    className="pl-10"
                    placeholder="Cari pasien / nomor"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <select
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as QueueStatus | 'all')
                    setPage(1)
                  }}
                >
                  {queueStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nomor</th>
                  <th className="px-4 py-3">Pasien</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posisi</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ticketsQuery.isLoading ? (
                  <TableSkeletonRows columns={5} />
                ) : filteredTickets.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    description={
                      tickets.length === 0
                        ? 'Belum ada pasien yang mengambil nomor di sesi ini.'
                        : 'Coba ubah kata kunci pencarian atau filter status.'
                    }
                    title={
                      tickets.length === 0
                        ? 'Belum ada antrean'
                        : 'Tidak ada pasien yang cocok'
                    }
                  />
                ) : (
                  paginatedTickets.items.map((ticket) => (
                    <tr className="transition hover:bg-slate-50/80" key={ticket.ticket_id}>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-teal-50 px-3 py-1 font-black text-teal-700">
                          {ticket.queue_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {ticket.patient_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ticket.polyclinic_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3 font-bold">
                        Saat ini {calledNumberLabel(ticket)}
                        <p className="text-xs font-semibold text-slate-500">
                          {remainingBeforeLabel(ticket)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setDetailTicket(ticket)}
                          >
                            <Eye size={16} />
                            Detail
                          </Button>
                          <QueueRowActions
                            ticket={ticket}
                            onAction={(status) =>
                              openPendingAction({
                                status,
                                ticket,
                                type: 'update-status',
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paginatedTickets.page}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={filteredTickets.length}
          />
        </Card>

        <ConfirmDialog
          confirmLabel={confirmState.confirmLabel}
          description={confirmState.description}
          icon={confirmState.icon}
          isLoading={
            callNextMutation.isPending ||
            recallMissedMutation.isPending ||
            updateStatusMutation.isPending ||
            closeSessionMutation.isPending
          }
          open={Boolean(pendingAction)}
          title={confirmState.title}
          tone={confirmState.tone}
          onCancel={() => {
            setPendingAction(null)
            setActionReason('')
            setActionReasonError(null)
          }}
          onConfirm={confirmPendingAction}
        >
          {confirmState.contextItems.length > 0 ? (
            <div className="mb-4 grid gap-2 rounded-xl bg-slate-50 p-3">
              {confirmState.contextItems.map((item) => (
                <div
                  className="flex items-start justify-between gap-3 text-sm"
                  key={item.label}
                >
                  <span className="font-bold text-slate-500">{item.label}</span>
                  <span className="text-right font-black text-slate-900">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {confirmState.requiresReason ? (
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Alasan untuk pasien dan histori
              </span>
              <textarea
                className="min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                placeholder={
                  pendingAction?.type === 'update-status' &&
                  pendingAction.status === 'missed'
                    ? 'Contoh: Pasien tidak hadir saat dipanggil.'
                    : pendingAction?.type === 'update-status' &&
                        pendingAction.status === 'skipped'
                    ? 'Contoh: Pasien tidak hadir saat dipanggil.'
                    : 'Contoh: Pasien meminta pembatalan antrean.'
                }
                value={actionReason}
                onChange={(event) => {
                  setActionReason(event.target.value)
                  setActionReasonError(null)
                }}
              />
              {actionReasonError ? (
                <span className="mt-1.5 block text-sm font-bold text-rose-600">
                  {actionReasonError}
                </span>
              ) : null}
            </label>
          ) : null}
        </ConfirmDialog>
        <FormDrawer
          description="Detail pasien, posisi antrean, dan jadwal layanan."
          open={Boolean(detailTicket)}
          title="Detail Antrean"
          onClose={() => {
            setDetailTicket(null)
            if (ticketParam) {
              const nextParams = new URLSearchParams(searchParams)
              nextParams.delete('ticket')
              setSearchParams(nextParams, { replace: true })
            }
          }}
        >
          {detailTicket ? (
            <TicketDetailPanel
              ticket={detailTicket}
              onAction={(status) => {
                openPendingAction({
                  status,
                  ticket: detailTicket,
                  type: 'update-status',
                })
                setDetailTicket(null)
              }}
            />
          ) : null}
        </FormDrawer>
      </div>
    </AdminLayout>
  )
}

function QueueRowActions({
  onAction,
  ticket,
}: {
  onAction: (status: QueueStatus) => void
  ticket: QueueTicketDetail
}) {
  if (ticket.status === 'called') {
    const wasRecalled = ticket.missed_count > 0
    return (
      <>
        <Button onClick={() => onAction('serving')}>
          <Stethoscope size={16} />
          Layani
        </Button>
        <Button
          variant="ghost"
          onClick={() => onAction(wasRecalled ? 'skipped' : 'missed')}
        >
          <SkipForward size={16} />
          {wasRecalled ? 'Lewati Final' : 'Tidak Hadir'}
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batalkan
        </Button>
      </>
    )
  }

  if (ticket.status === 'serving') {
    return (
      <>
        <Button onClick={() => onAction('completed')}>
          <CheckCircle2 size={16} />
          Selesai
        </Button>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batalkan
        </Button>
      </>
    )
  }

  if (ticket.status === 'waiting') {
    return (
      <Button variant="danger" onClick={() => onAction('cancelled')}>
        <OctagonX size={16} />
        Batalkan
      </Button>
    )
  }

  if (ticket.status === 'missed') {
    return (
      <>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati Final
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batalkan
        </Button>
      </>
    )
  }

  return <FinalStatusPill status={ticket.status} />
}

function FinalStatusPill({ status }: { status: QueueStatus }) {
  const labels: Record<QueueStatus, string> = {
    waiting: 'Menunggu',
    called: 'Dipanggil',
    serving: 'Dilayani',
    missed: 'Panggil Ulang',
    completed: 'Final: Selesai',
    skipped: 'Final: Dilewati',
    cancelled: 'Final: Dibatalkan',
    expired: 'Final: Kedaluwarsa',
  }
  const tone =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-rose-50 text-rose-700'
        : status === 'missed'
          ? 'bg-violet-50 text-violet-700'
        : status === 'skipped'
          ? 'bg-orange-50 text-orange-700'
          : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-lg px-3 py-2 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}

function ControlMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  )
}

function QueueStatusSection({
  description,
  emptyLabel,
  tickets,
  title,
}: {
  description?: string
  emptyLabel: string
  tickets: QueueTicketDetail[]
  title: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {tickets.length}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {tickets.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
            {emptyLabel}
          </p>
        ) : (
          tickets.slice(0, 4).map((ticket) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"
              key={ticket.ticket_id}
            >
              <div>
                <p className="font-black text-slate-950">{ticket.queue_code}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {ticket.patient_name}
                </p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>
          ))
        )}
        {tickets.length > 4 ? (
          <p className="text-xs font-bold text-slate-500">
            +{tickets.length - 4} tiket lain ada di tabel detail.
          </p>
        ) : null}
      </div>
    </Card>
  )
}

function TicketDetailPanel({
  onAction,
  ticket,
}: {
  onAction: (status: QueueStatus) => void
  ticket: QueueTicketDetail
}) {
  const remaining = remainingBefore(ticket)
  const wasRecalled = ticket.missed_count > 0
  const noShowStatus: QueueStatus =
    ticket.status === 'called' && !wasRecalled ? 'missed' : 'skipped'
  const timelineQuery = useQuery({
    queryKey: ['queue-ticket-timeline', ticket.ticket_id],
    queryFn: () => fetchQueueTicketTimeline(ticket.ticket_id),
  })

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">
              {ticket.queue_code}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {ticket.patient_name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {ticket.polyclinic_name} - {ticket.doctor_name}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </Card>

      {ticket.status_reason ? (
        <Card className="border-rose-100 bg-rose-50 p-5">
          <h3 className="mb-2 font-black text-rose-950">Catatan status</h3>
          <p className="text-sm font-semibold leading-6 text-rose-700">
            {ticket.status_reason}
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Timeline antrean</h3>
        {timelineQuery.isLoading ? (
          <p className="text-sm font-semibold text-slate-500">
            Memuat timeline...
          </p>
        ) : timelineQuery.data && timelineQuery.data.length > 0 ? (
          <QueueTimeline events={timelineQuery.data} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
            Belum ada event tercatat untuk tiket ini.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Posisi antrean</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailMetric label="Nomor pasien" value={ticket.queue_number} />
          <DetailMetric label="Nomor dipanggil" value={ticket.current_number} />
          <DetailMetric label="Sisa sebelum pasien" value={remaining} />
          <DetailMetric label="Nomor pengguna" value={ticket.queue_code} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Jadwal</h3>
        <div className="grid gap-3">
          <DetailMetric label="Cabang" value={ticket.branch_name} />
          <DetailMetric label="Tanggal" value={ticket.schedule_date} />
          <DetailMetric
            label="Jam praktik"
            value={`${ticket.start_time.slice(0, 5)}-${ticket.end_time.slice(0, 5)}`}
          />
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={ticket.status !== 'called'}
          variant="secondary"
          onClick={() => onAction('serving')}
        >
          <Stethoscope size={16} />
          Layani
        </Button>
        <Button
          disabled={ticket.status !== 'serving'}
          variant="secondary"
          onClick={() => onAction('completed')}
        >
          <CheckCircle2 size={16} />
          Selesai
        </Button>
        <Button
          disabled={!['called', 'serving', 'missed'].includes(ticket.status)}
          variant="ghost"
          onClick={() => onAction(noShowStatus)}
        >
          <SkipForward size={16} />
          {ticket.status === 'called' && !wasRecalled
            ? 'Tidak Hadir'
            : 'Lewati Final'}
        </Button>
        <Button
          disabled={!isActiveStatus(ticket.status)}
          variant="danger"
          onClick={() => onAction('cancelled')}
        >
          <OctagonX size={16} />
          Batalkan
        </Button>
      </div>
    </div>
  )
}

function QueueTimeline({ events }: { events: QueueTicketTimelineItem[] }) {
  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const status = queueStatusMeta(event.new_status)
        const isLast = index === events.length - 1

        return (
          <div className="flex gap-3" key={event.event_id}>
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  status.backgroundClass,
                  status.textClass,
                ].join(' ')}
              >
                {status.icon}
              </div>
              {!isLast ? <div className="h-10 w-px bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-slate-950">{status.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase text-slate-500">
                  {actorLabel(event)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                {event.message ?? status.fallbackMessage}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {formatDateTimeLabel(event.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function queueStatusMeta(status: QueueStatus) {
  const meta: Record<
    QueueStatus,
    {
      backgroundClass: string
      fallbackMessage: string
      icon: ReactNode
      label: string
      textClass: string
    }
  > = {
    waiting: {
      backgroundClass: 'bg-blue-50',
      fallbackMessage: 'Nomor antrean dibuat dan masuk daftar tunggu.',
      icon: <Clock3 size={17} />,
      label: 'Menunggu',
      textClass: 'text-blue-700',
    },
    called: {
      backgroundClass: 'bg-amber-50',
      fallbackMessage: 'Nomor antrean dipanggil oleh petugas.',
      icon: <Megaphone size={17} />,
      label: 'Dipanggil',
      textClass: 'text-amber-700',
    },
    serving: {
      backgroundClass: 'bg-teal-50',
      fallbackMessage: 'Pelayanan pasien dimulai.',
      icon: <Stethoscope size={17} />,
      label: 'Dilayani',
      textClass: 'text-teal-700',
    },
    missed: {
      backgroundClass: 'bg-violet-50',
      fallbackMessage: 'Nomor terlewat dan menunggu panggil ulang.',
      icon: <RotateCcw size={17} />,
      label: 'Terlewat',
      textClass: 'text-violet-700',
    },
    completed: {
      backgroundClass: 'bg-emerald-50',
      fallbackMessage: 'Pelayanan pasien selesai.',
      icon: <CheckCircle2 size={17} />,
      label: 'Selesai',
      textClass: 'text-emerald-700',
    },
    skipped: {
      backgroundClass: 'bg-orange-50',
      fallbackMessage: 'Nomor antrean dilewati oleh petugas.',
      icon: <SkipForward size={17} />,
      label: 'Dilewati',
      textClass: 'text-orange-700',
    },
    cancelled: {
      backgroundClass: 'bg-rose-50',
      fallbackMessage: 'Antrean dibatalkan.',
      icon: <OctagonX size={17} />,
      label: 'Dibatalkan',
      textClass: 'text-rose-700',
    },
    expired: {
      backgroundClass: 'bg-slate-100',
      fallbackMessage: 'Antrean kedaluwarsa.',
      icon: <Clock3 size={17} />,
      label: 'Kedaluwarsa',
      textClass: 'text-slate-600',
    },
  }
  return meta[status]
}

function actorLabel(event: QueueTicketTimelineItem) {
  if (event.actor_type === 'patient') return 'Pasien'
  if (event.actor_type === 'staff') return event.actor_name ?? 'Petugas'
  return 'Sistem'
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function DetailMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  )
}

function MiniSessionStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

type SchedulePhase = 'none' | 'before-start' | 'operational' | 'after-end'

function getSchedulePhase(schedule: ScheduleAvailability): SchedulePhase {
  const now = new Date()
  const start = parseScheduleDateTime(schedule.schedule_date, schedule.start_time)
  const end = parseScheduleDateTime(schedule.schedule_date, schedule.end_time)

  if (now < start) return 'before-start'
  if (now >= end) return 'after-end'
  return 'operational'
}

function parseScheduleDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.slice(0, 5).split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

function sessionPhaseLabel(phase: SchedulePhase, isClosed = false) {
  if (isClosed) return 'Ditutup'
  if (phase === 'before-start') return 'Belum mulai'
  if (phase === 'operational') return 'Berjalan'
  if (phase === 'after-end') return 'Sisa antrean'
  return '-'
}

function remainingBefore(ticket: QueueTicketDetail) {
  return Math.max(
    ticket.remaining_before_me ?? ticket.queue_number - ticket.current_number - 1,
    0,
  )
}

function remainingBeforeLabel(ticket: QueueTicketDetail) {
  if (ticket.status === 'called') return 'Giliran pasien sekarang'
  if (ticket.status === 'serving') return 'Pasien sedang dilayani'
  const remaining = remainingBefore(ticket)
  if (remaining === 0) return 'Siap dipanggil'
  return `${remaining} antrean aktif sebelum pasien`
}

function calledNumberLabel(ticket: QueueTicketDetail) {
  if (ticket.current_number <= 0) return '-'
  return `${ticket.queue_prefix}${ticket.current_number.toString().padStart(3, '0')}`
}

function closeSessionSuccessMessage(result: CloseQueueSessionResult) {
  const parts = []
  if (result.expired_count > 0) {
    parts.push(`${result.expired_count} antrean menunggu kedaluwarsa`)
  }
  if ((result.skipped_missed_count ?? 0) > 0) {
    parts.push(`${result.skipped_missed_count} terlewat dilewati final`)
  }
  if (parts.length === 0) return 'Sesi ditutup. Semua antrean sudah final.'
  return `Sesi ditutup. ${parts.join(', ')}.`
}

function buildConfirmState(action: PendingQueueAction | null) {
  if (!action) {
    return {
      confirmLabel: 'Konfirmasi',
      contextItems: [],
      description: '',
      icon: <Activity size={20} />,
      requiresReason: false,
      title: '',
      tone: 'default' as const,
    }
  }

  if (action.type === 'call-next') {
    return {
      confirmLabel: 'Panggil',
      contextItems: [
        { label: 'Aturan', value: 'Pasien menunggu paling awal' },
      ],
      description: '',
      icon: <Megaphone size={20} />,
      requiresReason: false,
      title: 'Panggil antrean berikutnya?',
      tone: 'default' as const,
    }
  }

  if (action.type === 'recall-missed') {
    return {
      confirmLabel: 'Panggil Ulang',
      contextItems: [
        { label: 'Aturan', value: 'Hanya setelah antrean menunggu habis' },
        { label: 'Nomor', value: 'Tetap nomor lama' },
      ],
      description: '',
      icon: <RotateCcw size={20} />,
      requiresReason: false,
      title: 'Panggil ulang antrean terlewat?',
      tone: 'default' as const,
    }
  }

  if (action.type === 'close-session') {
    const hasWaiting = action.waitingCount > 0
    return {
      confirmLabel: 'Tutup Sesi',
      contextItems: [
        { label: 'Menunggu', value: hasWaiting ? `${action.waitingCount} akan kedaluwarsa` : 'Tidak ada' },
        { label: 'Dipanggil/dilayani', value: 'Harus sudah kosong' },
      ],
      description: '',
      icon: <Power size={20} />,
      requiresReason: false,
      title: 'Tutup sesi antrean?',
      tone: hasWaiting ? ('danger' as const) : ('default' as const),
    }
  }

  const labels: Record<QueueStatus, string> = {
    cancelled: 'Batalkan antrean',
    called: 'Panggil antrean',
    completed: 'Selesaikan pelayanan',
    expired: 'Kedaluwarsakan antrean',
    missed: 'Tandai tidak hadir',
    serving: 'Mulai pelayanan',
    skipped: 'Lewati antrean',
    waiting: 'Kembalikan ke menunggu',
  }

  return {
    confirmLabel:
      action.status === 'cancelled'
        ? 'Batalkan'
        : action.status === 'missed'
          ? 'Tidak Hadir'
        : action.status === 'skipped'
          ? 'Lewati'
          : 'Konfirmasi',
    contextItems: buildActionContextItems(action),
    description: '',
    icon: actionIcon(action.status),
    requiresReason: requiresReason(action.status),
    title: `${labels[action.status]}?`,
    tone:
      action.status === 'cancelled' || action.status === 'skipped'
        || action.status === 'missed'
        ? ('danger' as const)
        : ('default' as const),
  }
}

function requiresReason(status: QueueStatus) {
  return status === 'cancelled' || status === 'skipped' || status === 'missed'
}

function buildActionContextItems(action: Extract<PendingQueueAction, { type: 'update-status' }>) {
  return [
    { label: 'Nomor', value: action.ticket.queue_code },
    { label: 'Pasien', value: action.ticket.patient_name },
  ]
}

function actionIcon(status: QueueStatus) {
  if (status === 'serving') return <Stethoscope size={20} />
  if (status === 'completed') return <CheckCircle2 size={20} />
  if (status === 'missed') return <SkipForward size={20} />
  if (status === 'skipped') return <SkipForward size={20} />
  if (status === 'cancelled') return <OctagonX size={20} />
  if (status === 'called') return <Megaphone size={20} />
  return <Activity size={20} />
}

function formatDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parseDateInputValue(dateValue))
}

function parseDateInputValue(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function StatusBadge({ status }: { status: QueueStatus }) {
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
