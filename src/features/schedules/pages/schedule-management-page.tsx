import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FilterX,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { FeedbackBanner } from '../../../components/ui/feedback-banner'
import { FormDrawer } from '../../../components/ui/form-drawer'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { Pagination } from '../../../components/ui/pagination'
import { StatCard } from '../../../components/ui/stat-card'
import { TableEmptyState, TableSkeletonRows } from '../../../components/ui/table-state'
import { useToast } from '../../../components/ui/use-toast'
import { friendlySupabaseError } from '../../../lib/friendly-error'
import { paginateItems } from '../../../lib/pagination'
import { supabase } from '../../../lib/supabase'
import type { ScheduleAvailability, ScheduleStatus } from '../../../types/queue'
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedules,
  fetchScheduleManagementRows,
  fetchScheduleReferences,
  updateSchedule,
  type DuplicateScheduleResult,
  type SchedulePayload,
} from '../services/schedule-service'

type ScheduleDraft = {
  branch_id: string
  polyclinic_id: string
  doctor_id: string
  schedule_date: string
  start_time: string
  end_time: string
  quota_limit: string
  average_service_minutes: string
  status: ScheduleStatus
  notes: string
}

type Notice = {
  text: string
  title?: string
  tone: 'danger' | 'info' | 'success' | 'warning'
}

type PendingScheduleSave = {
  payload: SchedulePayload
  schedule: ScheduleAvailability | null
}

type PendingDuplicate = {
  description: string
  sourceLabel: string
  schedules: ScheduleAvailability[]
  targetDate: string
  title: string
}

type ScheduleTimeMode = 'all' | 'past' | 'today' | 'upcoming'

const statusOptions: Array<{ value: ScheduleStatus; label: string }> = [
  { value: 'open', label: 'Buka' },
  { value: 'closed', label: 'Tutup' },
  { value: 'full', label: 'Penuh' },
  { value: 'cancelled', label: 'Batal' },
]

const today = toDateInputValue(new Date())
const pageSize = 8
const timePresets = [
  { label: 'Pagi', start: '08:00', end: '12:00' },
  { label: 'Siang', start: '13:00', end: '16:00' },
  { label: 'Sore', start: '15:00', end: '18:00' },
  { label: 'Malam', start: '18:00', end: '21:00' },
]

const emptyDraft: ScheduleDraft = {
  branch_id: '',
  polyclinic_id: '',
  doctor_id: '',
  schedule_date: today,
  start_time: '08:00',
  end_time: '12:00',
  quota_limit: '20',
  average_service_minutes: '10',
  status: 'open',
  notes: '',
}

export function ScheduleManagementPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [detailSchedule, setDetailSchedule] = useState<ScheduleAvailability | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<ScheduleDraft>(emptyDraft)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ScheduleAvailability | null>(null)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)
  const [pendingSave, setPendingSave] = useState<PendingScheduleSave | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'all'>('all')
  const [timeMode, setTimeMode] = useState<ScheduleTimeMode>('today')

  const schedulesQuery = useQuery({
    queryKey: ['schedule-management'],
    queryFn: fetchScheduleManagementRows,
  })

  const referencesQuery = useQuery({
    queryKey: ['schedule-references'],
    queryFn: fetchScheduleReferences,
  })

  useEffect(() => {
    const channel = supabase
      .channel('admin-schedules-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctor_schedules' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
          void queryClient.invalidateQueries({ queryKey: ['schedules'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_sessions' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
          void queryClient.invalidateQueries({ queryKey: ['schedules'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const schedules = useMemo(
    () => schedulesQuery.data ?? [],
    [schedulesQuery.data],
  )
  const references = referencesQuery.data

  const stats = useMemo(() => {
    return {
      total: schedules.length,
      open: schedules.filter((schedule) => schedule.status === 'open').length,
      full: schedules.filter((schedule) => schedule.status === 'full').length,
      closed: schedules.filter((schedule) => schedule.status === 'closed').length,
    }
  }, [schedules])

  const scopedSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          matchesScheduleTimeMode(schedule, timeMode) &&
          (!dateFilter || schedule.schedule_date === dateFilter),
      ),
    [dateFilter, schedules, timeMode],
  )

  const selectedDateStats = useMemo(
    () => ({
      active: scopedSchedules.filter(
        (schedule) => schedule.status === 'open' || schedule.status === 'full',
      ).length,
      cancelled: scopedSchedules.filter(
        (schedule) => schedule.status === 'cancelled',
      ).length,
      total: scopedSchedules.length,
    }),
    [scopedSchedules],
  )
  const selectedDateReadiness = useMemo(
    () => buildDateReadiness(scopedSchedules, dateFilter, timeMode),
    [dateFilter, scopedSchedules, timeMode],
  )
  const duplicateSourceDate = dateFilter || (timeMode === 'today' ? today : '')

  const duplicatableSchedulesOnSelectedDate = useMemo(
    () =>
      scopedSchedules.filter(
        (schedule) => canDuplicateSchedule(schedule),
      ),
    [scopedSchedules],
  )

  const filteredSchedules = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return schedules.filter((schedule) => {
      const matchesStatus =
        statusFilter === 'all' || schedule.status === statusFilter
      const matchesTimeMode = matchesScheduleTimeMode(schedule, timeMode)
      const matchesDate = !dateFilter || schedule.schedule_date === dateFilter
      const searchableText = [
        schedule.polyclinic_name,
        schedule.doctor_name,
        schedule.branch_name,
        schedule.specialization ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        matchesTimeMode &&
        matchesStatus &&
        matchesDate &&
        searchableText.includes(normalizedSearch)
      )
    })
  }, [dateFilter, schedules, searchTerm, statusFilter, timeMode])
  const paginatedSchedules = useMemo(
    () => paginateItems(filteredSchedules, page, pageSize),
    [filteredSchedules, page],
  )

  const filteredPolyclinics =
    references?.polyclinics.filter(
      (polyclinic) =>
        (!draft.branch_id || polyclinic.branch_id === draft.branch_id) &&
        (polyclinic.is_active || polyclinic.id === draft.polyclinic_id),
    ) ?? []

  const assignedDoctorIds = new Set(
    references?.doctorPolyclinics
      .filter((assignment) => assignment.polyclinic_id === draft.polyclinic_id)
      .map((assignment) => assignment.doctor_id) ?? [],
  )

  const selectableDoctors =
    references?.doctors.filter(
      (doctor) =>
        (editingScheduleId && doctor.id === draft.doctor_id) ||
        (draft.polyclinic_id &&
          assignedDoctorIds.has(doctor.id) &&
          doctor.is_active),
    ) ?? []
  const draftPreview = useMemo(
    () =>
      buildDraftPreview({
        draft,
        editingScheduleId,
        schedules,
      }),
    [draft, editingScheduleId, schedules],
  )

  function defaultDraft(): ScheduleDraft {
    return {
      ...emptyDraft,
      branch_id: references?.branches[0]?.id ?? '',
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SchedulePayload) =>
      editingScheduleId
        ? updateSchedule(editingScheduleId, payload)
        : createSchedule(payload),
    onSuccess: async () => {
      const successMessage = editingScheduleId
        ? 'Jadwal berhasil diperbarui.'
        : 'Jadwal baru berhasil dibuat.'
      setNotice({
        text: successMessage,
        tone: 'success',
      })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setEditingScheduleId(null)
      setDraft(emptyDraft)
      setPendingSave(null)
      setIsDrawerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menyimpan jadwal.')
      setNotice({
        text: message,
        title: 'Jadwal gagal disimpan',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menyimpan', tone: 'danger' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: async () => {
      const successMessage = 'Jadwal berhasil dihapus.'
      setNotice({ text: successMessage, tone: 'success' })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menghapus jadwal.')
      setNotice({
        text: message,
        title: 'Jadwal gagal dihapus',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menghapus', tone: 'danger' })
      setPendingDelete(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: ({
      schedules: schedulesToDuplicate,
      targetDate,
    }: {
      schedules: ScheduleAvailability[]
      targetDate: string
    }) => duplicateSchedules(schedulesToDuplicate, targetDate),
    onSuccess: async (result) => {
      const message = buildDuplicateSuccessMessage(result)
      setNotice({
        text: message,
        tone: result.failed > 0 ? 'warning' : 'success',
        title: result.failed > 0 ? 'Duplikasi sebagian berhasil' : undefined,
      })
      notify({
        message,
        title: result.failed > 0 ? 'Sebagian berhasil' : 'Berhasil',
        tone: result.failed > 0 ? 'warning' : 'success',
      })
      setPendingDuplicate(null)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menduplikasi jadwal.')
      setNotice({
        text: message,
        title: 'Duplikasi jadwal gagal',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal duplikasi', tone: 'danger' })
      setPendingDuplicate(null)
    },
  })

  function updateDraft(key: keyof ScheduleDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branch_id' ? { doctor_id: '', polyclinic_id: '' } : {}),
      ...(key === 'polyclinic_id' ? { doctor_id: '' } : {}),
    }))
  }

  function startCreate() {
    setNotice(null)
    setEditingScheduleId(null)
    setDraft(defaultDraft())
    setIsDrawerOpen(true)
  }

  function startDuplicateSchedule(schedule: ScheduleAvailability) {
    if (!canDuplicateSchedule(schedule)) {
      setNotice({
        text: isPastSchedule(schedule)
          ? 'Jadwal terlewat hanya bisa dilihat sebagai histori. Buat jadwal baru untuk layanan berikutnya.'
          : 'Jadwal yang sudah batal tidak diduplikasi. Buat jadwal baru bila layanan ingin dibuka kembali.',
        title: isPastSchedule(schedule) ? 'Jadwal terlewat' : 'Jadwal batal',
        tone: 'warning',
      })
      return
    }

    const targetDate = addDays(schedule.schedule_date, 1)
    setPendingDuplicate({
      description: `${schedule.polyclinic_name} bersama ${schedule.doctor_name} akan disalin ke ${formatDateLabel(targetDate)} dengan jam, kuota, dan durasi yang sama.`,
      sourceLabel: `${schedule.polyclinic_name} - ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`,
      schedules: [schedule],
      targetDate,
      title: 'Duplikat jadwal ke hari berikutnya?',
    })
  }

  function startDuplicateSelectedDate() {
    if (!duplicateSourceDate || duplicatableSchedulesOnSelectedDate.length === 0) return
    const targetDate = addDays(duplicateSourceDate, 1)
    setPendingDuplicate({
      description: `${duplicatableSchedulesOnSelectedDate.length} jadwal pada ${formatDateLabel(duplicateSourceDate)} akan disalin ke tanggal tujuan. Jadwal batal dan jadwal terlewat tidak ikut disalin, dan jadwal yang bentrok akan dilewati oleh sistem.`,
      sourceLabel: formatDateLabel(duplicateSourceDate),
      schedules: duplicatableSchedulesOnSelectedDate,
      targetDate,
      title: 'Duplikat jadwal tanggal terpilih?',
    })
  }

  function startEdit(schedule: ScheduleAvailability) {
    if (!canEditSchedule(schedule)) {
      setNotice({
        text: 'Jadwal terlewat hanya bisa dilihat untuk audit. Buat jadwal baru jika perlu membuka layanan lagi.',
        title: 'Jadwal read-only',
        tone: 'warning',
      })
      return
    }

    setNotice(null)
    setEditingScheduleId(schedule.schedule_id)
    setDraft({
      branch_id: schedule.branch_id,
      polyclinic_id: schedule.polyclinic_id,
      doctor_id: schedule.doctor_id,
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      quota_limit: String(schedule.quota_limit),
      average_service_minutes: String(schedule.average_service_minutes),
      status: schedule.status,
      notes: '',
    })
    setIsDrawerOpen(true)
  }

  function resetForm() {
    setNotice(null)
    setEditingScheduleId(null)
    setDraft(emptyDraft)
    setPendingSave(null)
    setIsDrawerOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const payload: SchedulePayload = {
      branch_id: draft.branch_id,
      polyclinic_id: draft.polyclinic_id,
      doctor_id: draft.doctor_id,
      schedule_date: draft.schedule_date,
      start_time: draft.start_time,
      end_time: draft.end_time,
      quota_limit: Number(draft.quota_limit),
      average_service_minutes: Number(draft.average_service_minutes),
      status: draft.status,
      notes: draft.notes.trim() || (editingScheduleId ? undefined : null),
    }

    if (!payload.branch_id || !payload.polyclinic_id || !payload.doctor_id) {
      setNotice({
        text: 'Cabang, poli, dan dokter wajib dipilih.',
        tone: 'warning',
      })
      return
    }

    const isDoctorAssignedToPolyclinic = references?.doctorPolyclinics.some(
      (assignment) =>
        assignment.polyclinic_id === payload.polyclinic_id &&
        assignment.doctor_id === payload.doctor_id,
    )

    if (!isDoctorAssignedToPolyclinic) {
      setNotice({
        text: 'Dokter yang dipilih tidak terhubung dengan poli tersebut.',
        tone: 'warning',
      })
      return
    }

    if (payload.end_time <= payload.start_time) {
      setNotice({
        text: 'Jam selesai harus lebih besar dari jam mulai.',
        tone: 'warning',
      })
      return
    }

    if (payload.schedule_date < today) {
      setNotice({
        text: 'Jadwal lampau tidak bisa dibuat atau diubah. Gunakan tanggal hari ini atau tanggal mendatang.',
        title: 'Tanggal tidak valid',
        tone: 'warning',
      })
      return
    }

    if (payload.quota_limit < 1 || payload.average_service_minutes < 1) {
      setNotice({
        text: 'Kuota dan durasi layanan minimal 1.',
        tone: 'warning',
      })
      return
    }

    const currentSchedule =
      schedules.find((schedule) => schedule.schedule_id === editingScheduleId) ??
      null

    if (editingScheduleId) {
      if (currentSchedule && !canEditSchedule(currentSchedule)) {
        setNotice({
          text: 'Jadwal terlewat tidak bisa diubah agar histori operasional tetap konsisten.',
          title: 'Jadwal read-only',
          tone: 'warning',
        })
        return
      }

      setPendingSave({ payload, schedule: currentSchedule })
      return
    }

    saveMutation.mutate(payload)
  }

  function confirmPendingSave() {
    if (!pendingSave) return
    saveMutation.mutate(pendingSave.payload)
  }

  function confirmPendingDuplicate() {
    if (!pendingDuplicate) return
    duplicateMutation.mutate({
      schedules: pendingDuplicate.schedules,
      targetDate: pendingDuplicate.targetDate,
    })
  }

  function updatePendingDuplicateTarget(targetDate: string) {
    setPendingDuplicate((current) =>
      current ? { ...current, targetDate } : current,
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <Button onClick={startCreate}>
                <Plus size={16} />
                Buat Jadwal
              </Button>
              <Button
                disabled={
                  !duplicateSourceDate ||
                  duplicatableSchedulesOnSelectedDate.length === 0
                }
                variant="secondary"
                onClick={startDuplicateSelectedDate}
              >
                <Copy size={16} />
                Duplikat Hari Berikutnya
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void schedulesQuery.refetch()
                  void referencesQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </>
          }
          description="Atur jadwal praktik, kuota pasien, status layanan, dan durasi pelayanan."
          eyebrow="Kontrol Jadwal"
          title="Manajemen Jadwal"
        />

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            helper="Seluruh jadwal praktik"
            icon={<CalendarRange size={20} />}
            label="Total Jadwal"
            tone="teal"
            value={stats.total}
          />
          <StatCard
            helper="Bisa menerima antrean"
            icon={<Clock3 size={20} />}
            label="Buka"
            tone="emerald"
            value={stats.open}
          />
          <StatCard
            helper="Kuota sudah penuh"
            icon={<CalendarPlus size={20} />}
            label="Penuh"
            tone="amber"
            value={stats.full}
          />
          <StatCard
            helper="Tidak menerima antrean"
            icon={<X size={20} />}
            label="Tutup"
            tone="slate"
            value={stats.closed}
          />
        </div>

        {notice && !isDrawerOpen ? (
          <FeedbackBanner title={notice.title} tone={notice.tone}>
            {notice.text}
          </FeedbackBanner>
        ) : null}

        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-black text-slate-950">Kontrol Tanggal</h3>
              <p className="text-sm text-slate-500">
                {dateFilter
                  ? `${selectedDateStats.total} jadwal pada ${formatDateLabel(dateFilter)}, ${selectedDateStats.active} masih aktif.`
                  : `${selectedDateStats.total} jadwal dalam mode ${scheduleTimeModeLabel(timeMode)}.`}
                {dateFilter && selectedDateStats.cancelled > 0
                  ? ` ${selectedDateStats.cancelled} jadwal batal tidak ikut diduplikasi.`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={timeMode === 'today' && !dateFilter ? 'primary' : 'secondary'}
                onClick={() => {
                  setTimeMode('today')
                  setDateFilter('')
                  setPage(1)
                }}
              >
                Hari Ini
              </Button>
              <Button
                variant={timeMode === 'upcoming' && !dateFilter ? 'primary' : 'secondary'}
                onClick={() => {
                  setTimeMode('upcoming')
                  setDateFilter('')
                  setPage(1)
                }}
              >
                Mendatang
              </Button>
              <Button
                variant={timeMode === 'past' && !dateFilter ? 'primary' : 'secondary'}
                onClick={() => {
                  setTimeMode('past')
                  setDateFilter('')
                  setPage(1)
                }}
              >
                Terlewat
              </Button>
              <Button
                variant={timeMode === 'all' && !dateFilter ? 'primary' : 'secondary'}
                onClick={() => {
                  setTimeMode('all')
                  setDateFilter('')
                  setPage(1)
                }}
              >
                Semua Tanggal
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setTimeMode('today')
                  setDateFilter('')
                  setPage(1)
                }}
              >
                <FilterX size={16} />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <DateReadinessPanel readiness={selectedDateReadiness} />

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="font-black">Daftar Jadwal Praktik</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {filteredSchedules.length} dari {schedules.length}{' '}
                  jadwal.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(220px,280px)_160px_180px]">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={17}
                  />
                  <Input
                    className="pl-10"
                    placeholder="Cari dokter / poli"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value)
                    setTimeMode('all')
                    setPage(1)
                  }}
                />
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as ScheduleStatus | 'all')
                    setPage(1)
                  }}
                >
                  <option value="all">Semua status</option>
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Poli & Dokter</th>
                  <th className="px-4 py-3">Jam</th>
                  <th className="px-4 py-3">Kuota</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedulesQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : filteredSchedules.length === 0 ? (
                  <TableEmptyState
                    action={
                      <Button onClick={startCreate}>
                        <Plus size={16} />
                        Buat Jadwal
                      </Button>
                    }
                    colSpan={6}
                    description="Buat jadwal praktik agar aplikasi pasien punya sesi antrean yang bisa dipilih."
                    title={
                      schedules.length === 0
                        ? 'Belum ada jadwal praktik'
                        : 'Tidak ada jadwal yang cocok'
                    }
                  />
                ) : (
                  paginatedSchedules.items.map((schedule) => (
                    <tr className="transition hover:bg-slate-50/80" key={schedule.schedule_id}>
                      <td className="px-4 py-3 font-bold">
                        {schedule.schedule_date}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {schedule.polyclinic_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {schedule.doctor_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-bold">
                          <Clock3 size={15} />
                          {schedule.start_time.slice(0, 5)}-
                          {schedule.end_time.slice(0, 5)}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {schedule.average_service_minutes} menit/pasien
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black">
                          {schedule.remaining_quota}/{schedule.quota_limit}
                        </p>
                        <p className="text-xs text-slate-500">
                          sisa kuota, {schedule.total_taken} sudah masuk
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ScheduleStatusBadge status={schedule.status} />
                        <div className="mt-1">
                          <SchedulePhaseBadge schedule={schedule} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setDetailSchedule(schedule)}
                          >
                            <Eye size={16} />
                            Detail
                          </Button>
                          {canEditSchedule(schedule) ? (
                            <Button
                              variant="secondary"
                              onClick={() => startEdit(schedule)}
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                          ) : null}
                          {canDuplicateSchedule(schedule) ? (
                            <Button
                              variant="secondary"
                              onClick={() => startDuplicateSchedule(schedule)}
                            >
                              <Copy size={16} />
                              Duplikat
                            </Button>
                          ) : null}
                          {canDeleteSchedule(schedule) ? (
                            <Button
                              variant="danger"
                              onClick={() => setPendingDelete(schedule)}
                            >
                              <Trash2 size={16} />
                              Hapus
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paginatedSchedules.page}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={filteredSchedules.length}
          />
        </Card>

        <FormDrawer
          description="Atur dokter, poli, tanggal, jam praktik, kuota, status, dan durasi rata-rata layanan."
          open={isDrawerOpen}
          title={editingScheduleId ? 'Edit Jadwal' : 'Buat Jadwal'}
          onClose={resetForm}
        >
          {notice ? (
            <div className="mb-4">
              <FeedbackBanner title={notice.title} tone={notice.tone}>
                {notice.text}
              </FeedbackBanner>
            </div>
          ) : null}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">
                  {editingScheduleId ? 'Detail Jadwal' : 'Jadwal Baru'}
                </h3>
                <p className="text-sm text-slate-500">
                  Jadwal aktif otomatis disiapkan sebagai sesi antrean.
                </p>
              </div>
              <CalendarPlus className="text-teal-600" size={22} />
            </div>

            <form className="space-y-4" onSubmit={submitForm}>
              <Field label="Cabang">
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={draft.branch_id}
                  onChange={(event) => updateDraft('branch_id', event.target.value)}
                >
                  <option value="">Pilih cabang</option>
                  {references?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Poli">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.polyclinic_id}
                    onChange={(event) =>
                      updateDraft('polyclinic_id', event.target.value)
                    }
                  >
                    <option value="">Pilih poli</option>
                    {filteredPolyclinics.map((polyclinic) => (
                      <option key={polyclinic.id} value={polyclinic.id}>
                        {polyclinic.name}
                        {polyclinic.is_active ? '' : ' (nonaktif)'}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Dokter">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.doctor_id}
                    onChange={(event) => updateDraft('doctor_id', event.target.value)}
                  >
                    <option value="">Pilih dokter</option>
                    {selectableDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.full_name}
                        {doctor.is_active ? '' : ' (nonaktif)'}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tanggal">
                <Input
                  min={today}
                  type="date"
                  value={draft.schedule_date}
                  onChange={(event) =>
                    updateDraft('schedule_date', event.target.value)
                  }
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mulai">
                  <Input
                    type="time"
                    value={draft.start_time}
                    onChange={(event) => updateDraft('start_time', event.target.value)}
                  />
                </Field>
                <Field label="Selesai">
                  <Input
                    type="time"
                    value={draft.end_time}
                    onChange={(event) => updateDraft('end_time', event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {timePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="secondary"
                    onClick={() => {
                      updateDraft('start_time', preset.start)
                      updateDraft('end_time', preset.end)
                    }}
                  >
                    <Clock3 size={15} />
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Kuota">
                  <Input
                    min={1}
                    type="number"
                    value={draft.quota_limit}
                    onChange={(event) => updateDraft('quota_limit', event.target.value)}
                  />
                </Field>
                <Field label="Durasi">
                  <Input
                    min={1}
                    type="number"
                    value={draft.average_service_minutes}
                    onChange={(event) =>
                      updateDraft('average_service_minutes', event.target.value)
                    }
                  />
                </Field>
                <Field label="Status">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft('status', event.target.value as ScheduleStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <ScheduleDraftPreview preview={draftPreview} />

              <div className="flex gap-2">
                <Button className="flex-1" disabled={saveMutation.isPending} type="submit">
                  {saveMutation.isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Simpan
                </Button>
                <Button variant="secondary" onClick={resetForm}>
                  <X size={16} />
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </FormDrawer>
        <FormDrawer
          description="Ringkasan operasional jadwal dan sesi antrean."
          open={Boolean(detailSchedule)}
          title="Detail Jadwal"
          onClose={() => setDetailSchedule(null)}
        >
          {detailSchedule ? (
            <ScheduleDetailPanel
              canEdit={canEditSchedule(detailSchedule)}
              schedule={detailSchedule}
              onEdit={() => {
                startEdit(detailSchedule)
                setDetailSchedule(null)
              }}
            />
          ) : null}
        </FormDrawer>
        <ConfirmDialog
          confirmLabel="Simpan Perubahan"
          description={buildScheduleConfirmDescription(pendingSave)}
          isLoading={saveMutation.isPending}
          open={Boolean(pendingSave)}
          title="Simpan perubahan jadwal?"
          tone={pendingSave?.schedule?.total_taken ? 'danger' : 'default'}
          onCancel={() => setPendingSave(null)}
          onConfirm={confirmPendingSave}
        />
        <ConfirmDialog
          confirmLabel="Hapus"
          description={buildScheduleDeleteDescription(pendingDelete)}
          icon={<Trash2 size={20} />}
          isLoading={deleteMutation.isPending}
          open={Boolean(pendingDelete)}
          title="Hapus jadwal?"
          tone="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (!pendingDelete) return
            if (!canDeleteSchedule(pendingDelete)) {
              setNotice({
                text: isPastSchedule(pendingDelete)
                  ? 'Jadwal terlewat tidak bisa dihapus dari panel operasional. Simpan sebagai histori.'
                  : 'Jadwal yang sudah memiliki antrean tidak bisa dihapus. Gunakan status Tutup atau Batal.',
                title: 'Hapus ditolak',
                tone: 'warning',
              })
              setPendingDelete(null)
              return
            }

            deleteMutation.mutate(pendingDelete.schedule_id)
          }}
        />
        <DuplicateScheduleDialog
          isLoading={duplicateMutation.isPending}
          pendingDuplicate={pendingDuplicate}
          today={today}
          onCancel={() => setPendingDuplicate(null)}
          onConfirm={confirmPendingDuplicate}
          onTargetDateChange={updatePendingDuplicateTarget}
        />
      </div>
    </AdminLayout>
  )
}

type DateReadiness = {
  description: string
  icon: ReactNode
  metrics: Array<{ label: string; value: number | string }>
  title: string
  tone: 'neutral' | 'success' | 'warning'
}

function DateReadinessPanel({ readiness }: { readiness: DateReadiness }) {
  const tone =
    readiness.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : readiness.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <Card className={`border p-4 ${tone}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
            {readiness.icon}
          </div>
          <div>
            <p className="text-xs font-black uppercase opacity-70">
              Readiness Tanggal
            </p>
            <h3 className="mt-1 font-black">{readiness.title}</h3>
            <p className="mt-1 text-sm font-semibold leading-6 opacity-80">
              {readiness.description}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
          {readiness.metrics.map((metric) => (
            <div className="rounded-xl bg-white/70 px-3 py-2" key={metric.label}>
              <p className="text-xs font-bold opacity-70">{metric.label}</p>
              <p className="mt-1 font-black">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

type DraftPreview = {
  conflictLabels: string[]
  estimatedCapacityMinutes: number
  estimatedSlots: number
  hasRequiredFields: boolean
  timeRangeLabel: string
}

function ScheduleDraftPreview({ preview }: { preview: DraftPreview }) {
  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3',
        preview.conflictLabels.length > 0
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-teal-200 bg-teal-50 text-teal-800',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {preview.conflictLabels.length > 0 ? (
            <AlertTriangle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black">
            {preview.conflictLabels.length > 0
              ? 'Periksa potensi bentrok jadwal'
              : 'Preview operasional jadwal'}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <PreviewMetric label="Jam" value={preview.timeRangeLabel} />
            <PreviewMetric
              label="Slot waktu"
              value={preview.hasRequiredFields ? preview.estimatedSlots : '-'}
            />
            <PreviewMetric
              label="Total menit"
              value={
                preview.hasRequiredFields
                  ? `${preview.estimatedCapacityMinutes} menit`
                  : '-'
              }
            />
          </div>
          {preview.conflictLabels.length > 0 ? (
            <div className="mt-3 space-y-1 text-sm font-semibold leading-6">
              {preview.conflictLabels.map((label) => (
                <p key={label}>{label}</p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold leading-6 opacity-80">
              Jika status Buka, jadwal ini akan muncul di aplikasi pasien sesuai
              aturan jam operasional.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <p className="text-xs font-bold opacity-70">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  )
}

function DuplicateScheduleDialog({
  isLoading,
  onCancel,
  onConfirm,
  onTargetDateChange,
  pendingDuplicate,
  today,
}: {
  isLoading: boolean
  onCancel: () => void
  onConfirm: () => void
  onTargetDateChange: (date: string) => void
  pendingDuplicate: PendingDuplicate | null
  today: string
}) {
  if (!pendingDuplicate) return null

  const canConfirm = pendingDuplicate.schedules.length > 0 && pendingDuplicate.targetDate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <button
        aria-label="Tutup dialog duplikasi"
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Copy size={20} />
            </div>
            <div>
              <h2 className="font-black text-slate-950">
                {pendingDuplicate.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {pendingDuplicate.description}
              </p>
            </div>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailMetric label="Sumber" value={pendingDuplicate.sourceLabel} />
            <DetailMetric
              label="Jumlah"
              value={`${pendingDuplicate.schedules.length} jadwal`}
            />
          </div>

          <Field label="Tanggal tujuan">
            <Input
              min={today}
              type="date"
              value={pendingDuplicate.targetDate}
              onChange={(event) => onTargetDateChange(event.target.value)}
            />
          </Field>

          <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
            Jam praktik, dokter, poli, kuota, durasi, dan status akan disalin.
            Kalau kombinasi dokter, poli, tanggal, dan jam mulai sudah ada,
            jadwal tersebut akan dilewati.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <Button disabled={isLoading} variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button disabled={isLoading || !canConfirm} onClick={onConfirm}>
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
            Duplikat
          </Button>
        </div>
      </div>
    </div>
  )
}

function ScheduleDetailPanel({
  canEdit,
  onEdit,
  schedule,
}: {
  canEdit: boolean
  onEdit: () => void
  schedule: ScheduleAvailability
}) {
  const quotaUsage =
    schedule.quota_limit === 0
      ? 0
      : Math.round((schedule.total_taken / schedule.quota_limit) * 100)

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">
              {schedule.branch_name}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {schedule.polyclinic_name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {schedule.doctor_name}
            </p>
          </div>
          <ScheduleStatusBadge status={schedule.status} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <DetailMetric label="Tanggal" value={schedule.schedule_date} />
          <DetailMetric label="Mode" value={schedulePhaseLabel(schedule)} />
          <DetailMetric
            label="Jam praktik"
            value={`${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`}
          />
          <DetailMetric
            label="Durasi layanan"
            value={`${schedule.average_service_minutes} menit/pasien`}
          />
          <DetailMetric
            label="Sesi antrean"
            value={schedule.queue_session_id ? 'Tersedia' : 'Belum tersedia'}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-950">Kapasitas</h3>
          <span className="text-sm font-black text-teal-700">{quotaUsage}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600"
            style={{ width: `${Math.min(quotaUsage, 100)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DetailMetric label="Diambil" value={schedule.total_taken} />
          <DetailMetric label="Kuota" value={schedule.quota_limit} />
          <DetailMetric label="Sisa" value={schedule.remaining_quota} />
        </div>
      </Card>

      {canEdit ? (
        <Button className="w-full" variant="secondary" onClick={onEdit}>
          <Pencil size={16} />
          Edit Jadwal
        </Button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
          Jadwal terlewat bersifat read-only untuk menjaga histori antrean.
        </div>
      )}
    </div>
  )
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

function buildScheduleConfirmDescription(pendingSave: PendingScheduleSave | null) {
  const schedule = pendingSave?.schedule
  if (!pendingSave || !schedule) {
    return 'Perubahan jadwal akan disimpan ke database.'
  }

  if (schedule.total_taken > 0) {
    return `Jadwal ini sudah memiliki ${schedule.total_taken} tiket antrean. Perubahan dokter, poli, jam, kuota, atau status dapat memengaruhi pasien yang sedang menunggu.`
  }

  return 'Perubahan jadwal akan memengaruhi pilihan jadwal yang terlihat di aplikasi pasien.'
}

function buildScheduleDeleteDescription(schedule: ScheduleAvailability | null) {
  if (!schedule) return 'Jadwal akan dihapus.'

  if (schedule.total_taken > 0) {
    return `Jadwal ${schedule.polyclinic_name} sudah memiliki ${schedule.total_taken} tiket antrean. Sistem akan menolak hapus permanen; gunakan status Batal atau Tutup agar histori pasien tetap aman.`
  }

  return `Jadwal ${schedule.polyclinic_name} ${schedule.schedule_date} pukul ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)} akan dihapus permanen karena belum memiliki tiket antrean.`
}

function buildDuplicateSuccessMessage(result: DuplicateScheduleResult) {
  if (result.failed === 0) {
    return `${result.created} jadwal berhasil diduplikasi.`
  }

  if (result.created === 0) {
    return 'Tidak ada jadwal yang berhasil diduplikasi. Kemungkinan jadwal tujuan sudah ada atau data referensi tidak aktif.'
  }

  return `${result.created} jadwal berhasil diduplikasi, ${result.failed} jadwal dilewati karena bentrok atau tidak valid.`
}

function buildDateReadiness(
  schedules: ScheduleAvailability[],
  dateFilter: string,
  timeMode: ScheduleTimeMode,
): DateReadiness {
  const open = schedules.filter((schedule) => schedule.status === 'open').length
  const full = schedules.filter((schedule) => schedule.status === 'full').length
  const closed = schedules.filter((schedule) => schedule.status === 'closed').length
  const cancelled = schedules.filter(
    (schedule) => schedule.status === 'cancelled',
  ).length
  const capacity = schedules.reduce(
    (total, schedule) => total + schedule.quota_limit,
    0,
  )
  const taken = schedules.reduce((total, schedule) => total + schedule.total_taken, 0)
  const label = dateFilter
    ? formatDateLabel(dateFilter)
    : scheduleTimeModeLabel(timeMode)

  if (timeMode === 'past' && !dateFilter) {
    return {
      description:
        'Jadwal terlewat ditampilkan sebagai arsip operasional. Gunakan Detail untuk audit, bukan untuk perubahan data.',
      icon: <Clock3 size={20} />,
      metrics: [
        { label: 'Jadwal', value: schedules.length },
        { label: 'Buka', value: open },
        { label: 'Tutup', value: closed },
        { label: 'Batal', value: cancelled },
      ],
      title: 'Mode histori jadwal',
      tone: 'neutral',
    }
  }

  if (schedules.length === 0) {
    return {
      description: `Belum ada jadwal untuk ${label}. Buat minimal satu jadwal agar pasien bisa melihat sesi antrean.`,
      icon: <CalendarPlus size={20} />,
      metrics: [
        { label: 'Jadwal', value: 0 },
        { label: 'Buka', value: 0 },
        { label: 'Kuota', value: 0 },
        { label: 'Terambil', value: 0 },
      ],
      title: 'Belum siap menerima antrean',
      tone: 'warning',
    }
  }

  if (open === 0) {
    return {
      description: `${label} sudah punya jadwal, tetapi belum ada sesi berstatus Buka. Pasien belum bisa mengambil nomor baru.`,
      icon: <AlertTriangle size={20} />,
      metrics: [
        { label: 'Jadwal', value: schedules.length },
        { label: 'Buka', value: open },
        { label: 'Tutup', value: closed },
        { label: 'Batal', value: cancelled },
      ],
      title: 'Jadwal belum menerima pasien',
      tone: 'warning',
    }
  }

  return {
    description: `${label} siap ditampilkan ke pasien. Pantau kuota dan ubah status jika sesi perlu ditutup sementara.`,
    icon: <CheckCircle2 size={20} />,
    metrics: [
      { label: 'Jadwal', value: schedules.length },
      { label: 'Buka', value: open },
      { label: 'Penuh', value: full },
      { label: 'Kuota', value: `${taken}/${capacity}` },
    ],
    title: 'Jadwal siap operasional',
    tone: 'success',
  }
}

function buildDraftPreview({
  draft,
  editingScheduleId,
  schedules,
}: {
  draft: ScheduleDraft
  editingScheduleId: string | null
  schedules: ScheduleAvailability[]
}): DraftPreview {
  const startMinutes = timeToMinutes(draft.start_time)
  const endMinutes = timeToMinutes(draft.end_time)
  const averageMinutes = Number(draft.average_service_minutes)
  const quotaLimit = Number(draft.quota_limit)
  const duration = Math.max(endMinutes - startMinutes, 0)
  const estimatedSlots =
    averageMinutes > 0 && duration > 0
      ? Math.floor(duration / averageMinutes)
      : 0
  const hasRequiredFields = Boolean(
    draft.branch_id &&
      draft.polyclinic_id &&
      draft.doctor_id &&
      draft.schedule_date &&
      draft.start_time &&
      draft.end_time &&
      quotaLimit > 0 &&
      averageMinutes > 0 &&
      duration > 0,
  )

  const conflicts = schedules.filter((schedule) => {
    if (schedule.schedule_id === editingScheduleId) return false
    if (schedule.schedule_date !== draft.schedule_date) return false
    if (schedule.status === 'cancelled') return false
    if (
      schedule.doctor_id !== draft.doctor_id &&
      schedule.polyclinic_id !== draft.polyclinic_id
    ) {
      return false
    }

    return rangesOverlap(
      startMinutes,
      endMinutes,
      timeToMinutes(schedule.start_time.slice(0, 5)),
      timeToMinutes(schedule.end_time.slice(0, 5)),
    )
  })

  const conflictLabels = conflicts.map(
    (schedule) =>
      `${schedule.polyclinic_name} - ${schedule.doctor_name} ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`,
  )

  if (hasRequiredFields && quotaLimit > estimatedSlots) {
    conflictLabels.push(
      `Kuota ${quotaLimit} lebih besar dari kapasitas slot waktu ${estimatedSlots}.`,
    )
  }

  return {
    conflictLabels,
    estimatedCapacityMinutes: duration,
    estimatedSlots,
    hasRequiredFields,
    timeRangeLabel: `${draft.start_time || '--:--'}-${draft.end_time || '--:--'}`,
  }
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return firstStart < secondEnd && secondStart < firstEnd
}

function timeToMinutes(timeValue: string) {
  const [hour = 0, minute = 0] = timeValue.split(':').map(Number)
  return hour * 60 + minute
}

function addDays(dateValue: string, amount: number) {
  const date = parseDateInputValue(dateValue)
  date.setDate(date.getDate() + amount)
  return toDateInputValue(date)
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

function matchesScheduleTimeMode(
  schedule: ScheduleAvailability,
  mode: ScheduleTimeMode,
) {
  if (mode === 'today') return schedule.schedule_date === today
  if (mode === 'upcoming') return schedule.schedule_date > today
  if (mode === 'past') return schedule.schedule_date < today
  return true
}

function isPastSchedule(schedule: ScheduleAvailability) {
  return schedule.schedule_date < today
}

function canEditSchedule(schedule: ScheduleAvailability) {
  return !isPastSchedule(schedule)
}

function canDeleteSchedule(schedule: ScheduleAvailability) {
  return !isPastSchedule(schedule) && schedule.total_taken === 0
}

function canDuplicateSchedule(schedule: ScheduleAvailability) {
  return !isPastSchedule(schedule) && schedule.status !== 'cancelled'
}

function scheduleTimeModeLabel(mode: ScheduleTimeMode) {
  const labels: Record<ScheduleTimeMode, string> = {
    all: 'Semua Tanggal',
    past: 'Terlewat',
    today: 'Hari Ini',
    upcoming: 'Mendatang',
  }
  return labels[mode]
}

function schedulePhaseLabel(schedule: ScheduleAvailability) {
  if (schedule.schedule_date < today) return 'Terlewat'
  if (schedule.schedule_date > today) return 'Mendatang'
  if (schedule.status === 'cancelled') return 'Batal'
  if (schedule.status === 'closed') return 'Ditutup'

  const now = new Date()
  const start = parseScheduleDateTime(schedule.schedule_date, schedule.start_time)
  const end = parseScheduleDateTime(schedule.schedule_date, schedule.end_time)

  if (now < start) return 'Belum mulai'
  if (now >= end) return 'Sisa antrean'
  return 'Berjalan'
}

function parseScheduleDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.slice(0, 5).split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

function Field({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const label =
    statusOptions.find((statusOption) => statusOption.value === status)?.label ??
    status
  const tone =
    status === 'open'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'full'
        ? 'bg-amber-50 text-amber-700'
        : status === 'closed'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-rose-50 text-rose-700'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {label}
    </span>
  )
}

function SchedulePhaseBadge({ schedule }: { schedule: ScheduleAvailability }) {
  const label = schedulePhaseLabel(schedule)
  const tone =
    label === 'Berjalan'
      ? 'bg-teal-50 text-teal-700'
      : label === 'Sisa antrean'
        ? 'bg-amber-50 text-amber-700'
        : label === 'Terlewat'
          ? 'bg-slate-100 text-slate-600'
          : label === 'Mendatang' || label === 'Belum mulai'
            ? 'bg-blue-50 text-blue-700'
            : label === 'Batal'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {label}
    </span>
  )
}
