import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UsersRound,
} from 'lucide-react'

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
import type { Doctor, Polyclinic } from '../../../types/queue'
import {
  createDoctor,
  deleteDoctor,
  fetchDoctorManagementData,
  updateDoctor,
  type DoctorSavePayload,
} from '../services/doctor-service'

type DoctorDraft = {
  bio: string
  default_service_minutes: string
  full_name: string
  is_active: boolean
  license_number: string
  polyclinic_ids: string[]
  specialization: string
}

const emptyDoctorDraft: DoctorDraft = {
  bio: '',
  default_service_minutes: '10',
  full_name: '',
  is_active: true,
  license_number: '',
  polyclinic_ids: [],
  specialization: '',
}
const pageSize = 8

type Notice = {
  text: string
  title?: string
  tone: 'danger' | 'info' | 'success' | 'warning'
}

type PendingDoctorSave = {
  doctor: Doctor | null
  payload: DoctorSavePayload
}

export function DoctorManagementPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [draft, setDraft] = useState<DoctorDraft>(emptyDoctorDraft)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Doctor | null>(null)
  const [pendingSave, setPendingSave] = useState<PendingDoctorSave | null>(null)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [activityFilter, setActivityFilter] = useState<
    'active' | 'all' | 'inactive'
  >('all')

  const masterDataQuery = useQuery({
    queryKey: ['doctor-management'],
    queryFn: fetchDoctorManagementData,
  })

  const doctors = useMemo(
    () => masterDataQuery.data?.doctors ?? [],
    [masterDataQuery.data?.doctors],
  )
  const polyclinics = useMemo(
    () => masterDataQuery.data?.polyclinics ?? [],
    [masterDataQuery.data?.polyclinics],
  )
  const doctorPolyclinics = useMemo(
    () => masterDataQuery.data?.doctorPolyclinics ?? [],
    [masterDataQuery.data?.doctorPolyclinics],
  )
  const polyclinicNameById = useMemo(
    () =>
      new Map(
        polyclinics.map((polyclinic) => [polyclinic.id, polyclinic.name]),
      ),
    [polyclinics],
  )
  const polyclinicIdsByDoctorId = useMemo(() => {
    const assignments = new Map<string, string[]>()

    doctorPolyclinics.forEach((assignment) => {
      const current = assignments.get(assignment.doctor_id) ?? []
      current.push(assignment.polyclinic_id)
      assignments.set(assignment.doctor_id, current)
    })

    return assignments
  }, [doctorPolyclinics])
  const activePolyclinics = useMemo(
    () => polyclinics.filter((polyclinic) => polyclinic.is_active),
    [polyclinics],
  )

  const stats = useMemo(
    () => ({
      active: doctors.filter((doctor) => doctor.is_active).length,
      inactive: doctors.filter((doctor) => !doctor.is_active).length,
      total: doctors.length,
    }),
    [doctors],
  )

  const filteredDoctors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return doctors.filter((doctor) => {
      const matchesActivity =
        activityFilter === 'all' ||
        (activityFilter === 'active' ? doctor.is_active : !doctor.is_active)
      const searchableText = [
        doctor.full_name,
        doctor.license_number ?? '',
        doctor.specialization ?? '',
        doctor.bio ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return matchesActivity && searchableText.includes(normalizedSearch)
    })
  }, [activityFilter, doctors, searchTerm])
  const paginatedDoctors = useMemo(
    () => paginateItems(filteredDoctors, page, pageSize),
    [filteredDoctors, page],
  )

  const doctorMutation = useMutation({
    mutationFn: (payload: DoctorSavePayload) =>
      editingDoctorId
        ? updateDoctor(editingDoctorId, payload)
        : createDoctor(payload),
    onSuccess: async () => {
      const successMessage = editingDoctorId
        ? 'Data dokter berhasil diperbarui.'
        : 'Dokter baru berhasil ditambahkan.'
      setNotice({
        text: successMessage,
        tone: 'success',
      })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setPendingSave(null)
      resetForm()
      await queryClient.invalidateQueries({ queryKey: ['doctor-management'] })
      await queryClient.invalidateQueries({ queryKey: ['doctors'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-references'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menyimpan dokter.')
      setNotice({
        text: message,
        title: 'Data dokter gagal disimpan',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menyimpan', tone: 'danger' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDoctor,
    onSuccess: async (result) => {
      const successMessage =
        result === 'archived'
          ? 'Dokter sudah dipakai pada histori jadwal, jadi data berhasil diarsipkan sebagai nonaktif.'
          : 'Data dokter berhasil dihapus.'
      setNotice({ text: successMessage, tone: 'success' })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['doctor-management'] })
      await queryClient.invalidateQueries({ queryKey: ['doctors'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-references'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menghapus dokter.')
      setNotice({
        text: message,
        title: 'Data dokter gagal dihapus',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menghapus', tone: 'danger' })
      setPendingDelete(null)
    },
  })

  function updateDraft(
    key: keyof DoctorDraft,
    value: boolean | string | string[],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function startCreate() {
    setNotice(null)
    setEditingDoctorId(null)
    setDraft(emptyDoctorDraft)
    setIsDrawerOpen(true)
  }

  function startEdit(doctor: Doctor) {
    setNotice(null)
    setEditingDoctorId(doctor.id)
    setDraft({
      bio: doctor.bio ?? '',
      default_service_minutes: String(doctor.default_service_minutes),
      full_name: doctor.full_name,
      is_active: doctor.is_active,
      license_number: doctor.license_number ?? '',
      polyclinic_ids: polyclinicIdsByDoctorId.get(doctor.id) ?? [],
      specialization: doctor.specialization ?? '',
    })
    setIsDrawerOpen(true)
  }

  function resetForm() {
    setEditingDoctorId(null)
    setDraft(emptyDoctorDraft)
    setPendingSave(null)
    setIsDrawerOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const payload: DoctorSavePayload = {
      bio: draft.bio.trim() || null,
      default_service_minutes: Number(draft.default_service_minutes),
      full_name: draft.full_name.trim(),
      is_active: draft.is_active,
      license_number: draft.license_number.trim() || null,
      polyclinic_ids: draft.polyclinic_ids,
      specialization: draft.specialization.trim() || null,
    }

    if (!payload.full_name) {
      setNotice({ text: 'Nama dokter wajib diisi.', tone: 'warning' })
      return
    }

    if (payload.default_service_minutes < 1) {
      setNotice({
        text: 'Durasi layanan default minimal 1 menit.',
        tone: 'warning',
      })
      return
    }

    if (payload.polyclinic_ids.length === 0) {
      setNotice({
        text: 'Pilih minimal satu poli untuk dokter ini agar dokter bisa muncul saat membuat jadwal.',
        title: 'Poli dokter wajib dipilih',
        tone: 'warning',
      })
      return
    }

    const currentDoctor =
      doctors.find((doctor) => doctor.id === editingDoctorId) ?? null

    if (editingDoctorId && currentDoctor?.is_active && !payload.is_active) {
      setPendingSave({ doctor: currentDoctor, payload })
      return
    }

    doctorMutation.mutate(payload)
  }

  function confirmPendingSave() {
    if (!pendingSave) return
    doctorMutation.mutate(pendingSave.payload)
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <Button onClick={startCreate}>
                <Plus size={16} />
                Tambah Dokter
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void masterDataQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </>
          }
          description="Kelola data dokter, spesialisasi, status aktif, SIP, dan durasi layanan default."
          eyebrow="Master Data"
          title="Manajemen Dokter"
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            helper="Seluruh dokter"
            icon={<UsersRound size={20} />}
            label="Total Dokter"
            tone="teal"
            value={stats.total}
          />
          <StatCard
            helper="Bisa dipilih di jadwal"
            icon={<ToggleRight size={22} />}
            label="Aktif"
            tone="emerald"
            value={stats.active}
          />
          <StatCard
            helper="Tidak tampil di jadwal baru"
            icon={<ToggleLeft size={22} />}
            label="Nonaktif"
            tone="slate"
            value={stats.inactive}
          />
        </div>

        {notice && !isDrawerOpen ? (
          <FeedbackBanner title={notice.title} tone={notice.tone}>
            {notice.text}
          </FeedbackBanner>
        ) : null}

        <Card className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <Input
                className="pl-10"
                placeholder="Cari dokter, SIP, spesialisasi"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              value={activityFilter}
              onChange={(event) => {
                setActivityFilter(
                  event.target.value as 'active' | 'all' | 'inactive',
                )
                setPage(1)
              }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </Card>

        <DoctorTable
          currentPage={paginatedDoctors.page}
          doctors={paginatedDoctors.items}
          filteredTotal={filteredDoctors.length}
          loading={masterDataQuery.isLoading}
          onCreate={startCreate}
          onDelete={setPendingDelete}
          onEdit={startEdit}
          onPageChange={setPage}
          pageSize={pageSize}
          polyclinicIdsByDoctorId={polyclinicIdsByDoctorId}
          polyclinicNameById={polyclinicNameById}
          total={doctors.length}
        />

        <FormDrawer
          description="Simpan identitas dokter, SIP, spesialisasi, durasi layanan, dan status aktif."
          open={isDrawerOpen}
          title={editingDoctorId ? 'Edit Dokter' : 'Tambah Dokter'}
          onClose={resetForm}
        >
          {notice ? (
            <div className="mb-4">
              <FeedbackBanner title={notice.title} tone={notice.tone}>
                {notice.text}
              </FeedbackBanner>
            </div>
          ) : null}
          <DoctorForm
            activePolyclinics={activePolyclinics}
            draft={draft}
            editing={Boolean(editingDoctorId)}
            loading={doctorMutation.isPending}
            onChange={updateDraft}
            polyclinics={polyclinics}
            onReset={() => {
              setNotice(null)
              resetForm()
            }}
            onSubmit={submitForm}
          />
        </FormDrawer>
        <ConfirmDialog
          confirmLabel="Nonaktifkan"
          description={
            pendingSave?.doctor
              ? `${pendingSave.doctor.full_name} tidak akan muncul sebagai pilihan utama saat admin membuat jadwal baru. Jadwal lama tetap tersimpan.`
              : 'Dokter akan disimpan sebagai nonaktif.'
          }
          isLoading={doctorMutation.isPending}
          open={Boolean(pendingSave)}
          title="Nonaktifkan dokter?"
          tone="danger"
          onCancel={() => setPendingSave(null)}
          onConfirm={confirmPendingSave}
        />
        <ConfirmDialog
          confirmLabel="Hapus"
          description={
            pendingDelete
              ? `${pendingDelete.full_name} akan dihapus permanen jika belum pernah dipakai pada jadwal praktik. Jika sudah punya histori, sistem akan mengarsipkan sebagai nonaktif agar riwayat jadwal tetap aman.`
              : 'Data dokter akan dihapus atau diarsipkan.'
          }
          icon={<Trash2 size={20} />}
          isLoading={deleteMutation.isPending}
          open={Boolean(pendingDelete)}
          title="Hapus atau arsipkan dokter?"
          tone="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
          }}
        />
      </div>
    </AdminLayout>
  )
}

function DoctorForm({
  activePolyclinics,
  draft,
  editing,
  loading,
  onChange,
  polyclinics,
  onReset,
  onSubmit,
}: {
  activePolyclinics: Polyclinic[]
  draft: DoctorDraft
  editing: boolean
  loading: boolean
  onChange: (key: keyof DoctorDraft, value: boolean | string | string[]) => void
  polyclinics: Polyclinic[]
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const selectablePolyclinics = polyclinics.filter(
    (polyclinic) =>
      polyclinic.is_active || draft.polyclinic_ids.includes(polyclinic.id),
  )

  return (
    <Card className="p-5">
      <FormHeader
        icon={<Stethoscope size={21} />}
        subtitle="Durasi default membantu pengisian jadwal praktik."
        title={editing ? 'Edit Dokter' : 'Tambah Dokter'}
      />
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Nama dokter">
          <Input
            placeholder="Dr. Nama Dokter"
            value={draft.full_name}
            onChange={(event) => onChange('full_name', event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nomor SIP">
            <Input
              placeholder="SIP-001"
              value={draft.license_number}
              onChange={(event) => onChange('license_number', event.target.value)}
            />
          </Field>
          <Field label="Spesialisasi">
            <Input
              placeholder="Dokter Umum"
              value={draft.specialization}
              onChange={(event) => onChange('specialization', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Durasi default">
          <Input
            min={1}
            type="number"
            value={draft.default_service_minutes}
            onChange={(event) =>
              onChange('default_service_minutes', event.target.value)
            }
          />
        </Field>
        <Field label="Poli dokter">
          {selectablePolyclinics.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectablePolyclinics.map((polyclinic) => {
                const checked = draft.polyclinic_ids.includes(polyclinic.id)

                return (
                  <label
                    className={[
                      'flex items-start gap-3 rounded-xl border px-3 py-3 text-sm transition',
                      checked
                        ? 'border-teal-200 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                    key={polyclinic.id}
                  >
                    <input
                      checked={checked}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      type="checkbox"
                      onChange={(event) => {
                        const nextPolyclinicIds = event.target.checked
                          ? [...draft.polyclinic_ids, polyclinic.id]
                          : draft.polyclinic_ids.filter(
                              (polyclinicId) => polyclinicId !== polyclinic.id,
                            )
                        onChange('polyclinic_ids', nextPolyclinicIds)
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-black">{polyclinic.name}</span>
                      <span className="text-xs font-semibold text-slate-500">
                        {polyclinic.is_active ? 'Aktif' : 'Nonaktif historis'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-800">
              Belum ada poli aktif. Aktifkan atau buat poli terlebih dulu.
            </div>
          )}
          {activePolyclinics.length > 0 ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Dokter hanya akan muncul di form jadwal untuk poli yang dipilih.
            </p>
          ) : null}
        </Field>
        <Field label="Catatan profil">
          <textarea
            className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            placeholder="Ringkasan layanan dokter"
            value={draft.bio}
            onChange={(event) => onChange('bio', event.target.value)}
          />
        </Field>
        <ToggleField
          active={draft.is_active}
          label="Status dokter"
          onChange={(value) => onChange('is_active', value)}
        />
        <FormActions editing={editing} loading={loading} onReset={onReset} />
      </form>
    </Card>
  )
}

function DoctorTable({
  doctors,
  currentPage,
  filteredTotal,
  loading,
  onCreate,
  onDelete,
  onEdit,
  onPageChange,
  pageSize,
  polyclinicIdsByDoctorId,
  polyclinicNameById,
  total,
}: {
  currentPage: number
  doctors: Doctor[]
  filteredTotal: number
  loading: boolean
  onCreate: () => void
  onDelete: (doctor: Doctor) => void
  onEdit: (doctor: Doctor) => void
  onPageChange: (page: number) => void
  pageSize: number
  polyclinicIdsByDoctorId: Map<string, string[]>
  polyclinicNameById: Map<string, string>
  total: number
}) {
  return (
    <Card className="overflow-hidden">
      <TableHeader
        subtitle={`Menampilkan ${filteredTotal} dari ${total} dokter.`}
        title="Daftar Dokter"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Dokter</th>
              <th className="px-4 py-3">SIP</th>
              <th className="px-4 py-3">Poli</th>
              <th className="px-4 py-3">Durasi</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableSkeletonRows columns={6} />
            ) : doctors.length === 0 ? (
              <TableEmptyState
                action={
                  <Button onClick={onCreate}>
                    <Plus size={16} />
                    Tambah Dokter
                  </Button>
                }
                colSpan={6}
                description="Tambahkan dokter agar jadwal praktik bisa dibuat dan muncul di aplikasi pasien."
                title={total === 0 ? 'Belum ada dokter' : 'Tidak ada dokter yang cocok'}
              />
            ) : (
              doctors.map((doctor) => (
                <tr className="transition hover:bg-slate-50/80" key={doctor.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{doctor.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {doctor.specialization ?? 'Belum ada spesialisasi'}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {doctor.license_number ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <DoctorPolyclinicBadges
                      polyclinicIds={polyclinicIdsByDoctorId.get(doctor.id) ?? []}
                      polyclinicNameById={polyclinicNameById}
                    />
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {doctor.default_service_minutes} menit
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={doctor.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => onEdit(doctor)}>
                        <Pencil size={16} />
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => onDelete(doctor)}>
                        <Trash2 size={16} />
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        onPageChange={onPageChange}
        pageSize={pageSize}
        totalItems={filteredTotal}
      />
    </Card>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function FormHeader({
  icon,
  subtitle,
  title,
}: {
  icon: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-lg font-black">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </div>
    </div>
  )
}

function FormActions({
  editing,
  loading,
  onReset,
}: {
  editing: boolean
  loading: boolean
  onReset: () => void
}) {
  return (
    <div className="flex gap-2">
      <Button className="flex-1" disabled={loading} type="submit">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        {editing ? 'Update' : 'Simpan'}
      </Button>
      <Button variant="secondary" onClick={onReset}>
        Reset
      </Button>
    </div>
  )
}

function ToggleField({
  active,
  label,
  onChange,
}: {
  active: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
      type="button"
      onClick={() => onChange(!active)}
    >
      <span>
        <span className="block text-sm font-bold text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {active ? 'Data aktif dan bisa dipakai.' : 'Data disimpan nonaktif.'}
        </span>
      </span>
      {active ? (
        <ToggleRight className="text-teal-600" size={28} />
      ) : (
        <ToggleLeft className="text-slate-400" size={28} />
      )}
    </button>
  )
}

function TableHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="border-b border-slate-200 px-4 py-3">
      <h3 className="font-black">{title}</h3>
      {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'rounded-full px-3 py-1 text-xs font-black',
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}

function DoctorPolyclinicBadges({
  polyclinicIds,
  polyclinicNameById,
}: {
  polyclinicIds: string[]
  polyclinicNameById: Map<string, string>
}) {
  if (polyclinicIds.length === 0) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
        Belum diassign
      </span>
    )
  }

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1.5">
      {polyclinicIds.slice(0, 3).map((polyclinicId) => (
        <span
          className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700"
          key={polyclinicId}
        >
          {polyclinicNameById.get(polyclinicId) ?? 'Poli tidak ditemukan'}
        </span>
      ))}
      {polyclinicIds.length > 3 ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
          +{polyclinicIds.length - 3}
        </span>
      ) : null}
    </div>
  )
}
