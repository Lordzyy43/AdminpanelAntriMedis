import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  Building2,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  UsersRound,
} from 'lucide-react'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import type { Doctor, Polyclinic } from '../../../types/queue'
import {
  createDoctor,
  createPolyclinic,
  fetchMasterData,
  updateDoctor,
  updatePolyclinic,
  type DoctorPayload,
  type PolyclinicPayload,
} from '../services/master-data-service'

type ActiveTab = 'doctors' | 'polyclinics'

type DoctorDraft = {
  full_name: string
  license_number: string
  specialization: string
  bio: string
  default_service_minutes: string
  is_active: boolean
}

type PolyclinicDraft = {
  branch_id: string
  name: string
  code: string
  description: string
  queue_prefix: string
  is_active: boolean
}

const emptyDoctorDraft: DoctorDraft = {
  full_name: '',
  license_number: '',
  specialization: '',
  bio: '',
  default_service_minutes: '10',
  is_active: true,
}

const emptyPolyclinicDraft: PolyclinicDraft = {
  branch_id: '',
  name: '',
  code: '',
  description: '',
  queue_prefix: '',
  is_active: true,
}

export function MasterDataPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('doctors')
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null)
  const [editingPolyclinicId, setEditingPolyclinicId] = useState<string | null>(null)
  const [doctorDraft, setDoctorDraft] = useState<DoctorDraft>(emptyDoctorDraft)
  const [polyclinicDraft, setPolyclinicDraft] =
    useState<PolyclinicDraft>(emptyPolyclinicDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activityFilter, setActivityFilter] = useState<'active' | 'all' | 'inactive'>(
    'all',
  )

  const masterDataQuery = useQuery({
    queryKey: ['master-data'],
    queryFn: fetchMasterData,
  })

  const masterData = masterDataQuery.data
  const doctors = useMemo(() => masterData?.doctors ?? [], [masterData?.doctors])
  const polyclinics = useMemo(
    () => masterData?.polyclinics ?? [],
    [masterData?.polyclinics],
  )
  const branches = masterData?.branches ?? []

  const doctorStats = useMemo(
    () => ({
      total: doctors.length,
      active: doctors.filter((doctor) => doctor.is_active).length,
      inactive: doctors.filter((doctor) => !doctor.is_active).length,
    }),
    [doctors],
  )

  const polyclinicStats = useMemo(
    () => ({
      total: polyclinics.length,
      active: polyclinics.filter((polyclinic) => polyclinic.is_active).length,
      inactive: polyclinics.filter((polyclinic) => !polyclinic.is_active).length,
    }),
    [polyclinics],
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

  const filteredPolyclinics = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return polyclinics.filter((polyclinic) => {
      const matchesActivity =
        activityFilter === 'all' ||
        (activityFilter === 'active'
          ? polyclinic.is_active
          : !polyclinic.is_active)
      const searchableText = [
        polyclinic.name,
        polyclinic.code,
        polyclinic.queue_prefix,
        polyclinic.description ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return matchesActivity && searchableText.includes(normalizedSearch)
    })
  }, [activityFilter, polyclinics, searchTerm])

  const doctorMutation = useMutation({
    mutationFn: (payload: DoctorPayload) =>
      editingDoctorId
        ? updateDoctor(editingDoctorId, payload)
        : createDoctor(payload),
    onSuccess: async () => {
      setMessage(
        editingDoctorId ? 'Data dokter berhasil diperbarui.' : 'Dokter baru berhasil ditambahkan.',
      )
      resetDoctorForm()
      await invalidateMasterData()
    },
    onError: showError,
  })

  const polyclinicMutation = useMutation({
    mutationFn: (payload: PolyclinicPayload) =>
      editingPolyclinicId
        ? updatePolyclinic(editingPolyclinicId, payload)
        : createPolyclinic(payload),
    onSuccess: async () => {
      setMessage(
        editingPolyclinicId ? 'Data poli berhasil diperbarui.' : 'Poli baru berhasil ditambahkan.',
      )
      resetPolyclinicForm()
      await invalidateMasterData()
    },
    onError: showError,
  })

  async function invalidateMasterData() {
    await queryClient.invalidateQueries({ queryKey: ['master-data'] })
    await queryClient.invalidateQueries({ queryKey: ['schedule-references'] })
    await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
    await queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : 'Gagal menyimpan data.')
  }

  function updateDoctorDraft(key: keyof DoctorDraft, value: string | boolean) {
    setDoctorDraft((current) => ({ ...current, [key]: value }))
  }

  function updatePolyclinicDraft(
    key: keyof PolyclinicDraft,
    value: string | boolean,
  ) {
    setPolyclinicDraft((current) => ({
      ...current,
      [key]: key === 'queue_prefix' && typeof value === 'string' ? value.toUpperCase() : value,
    }))
  }

  function resetDoctorForm() {
    setEditingDoctorId(null)
    setDoctorDraft(emptyDoctorDraft)
  }

  function resetPolyclinicForm() {
    setEditingPolyclinicId(null)
    setPolyclinicDraft(emptyPolyclinicDraft)
  }

  function startDoctorEdit(doctor: Doctor) {
    setMessage(null)
    setActiveTab('doctors')
    setEditingDoctorId(doctor.id)
    setDoctorDraft({
      full_name: doctor.full_name,
      license_number: doctor.license_number ?? '',
      specialization: doctor.specialization ?? '',
      bio: doctor.bio ?? '',
      default_service_minutes: String(doctor.default_service_minutes),
      is_active: doctor.is_active,
    })
  }

  function startPolyclinicEdit(polyclinic: Polyclinic) {
    setMessage(null)
    setActiveTab('polyclinics')
    setEditingPolyclinicId(polyclinic.id)
    setPolyclinicDraft({
      branch_id: polyclinic.branch_id,
      name: polyclinic.name,
      code: polyclinic.code,
      description: polyclinic.description ?? '',
      queue_prefix: polyclinic.queue_prefix,
      is_active: polyclinic.is_active,
    })
  }

  function submitDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const payload: DoctorPayload = {
      full_name: doctorDraft.full_name.trim(),
      license_number: doctorDraft.license_number.trim() || null,
      specialization: doctorDraft.specialization.trim() || null,
      bio: doctorDraft.bio.trim() || null,
      default_service_minutes: Number(doctorDraft.default_service_minutes),
      is_active: doctorDraft.is_active,
    }

    if (!payload.full_name) {
      setMessage('Nama dokter wajib diisi.')
      return
    }

    if (payload.default_service_minutes < 1) {
      setMessage('Durasi layanan default minimal 1 menit.')
      return
    }

    doctorMutation.mutate(payload)
  }

  function submitPolyclinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const payload: PolyclinicPayload = {
      branch_id: polyclinicDraft.branch_id,
      name: polyclinicDraft.name.trim(),
      code: polyclinicDraft.code.trim().toUpperCase(),
      description: polyclinicDraft.description.trim() || null,
      queue_prefix: polyclinicDraft.queue_prefix.trim().toUpperCase(),
      is_active: polyclinicDraft.is_active,
    }

    if (!payload.branch_id || !payload.name || !payload.code || !payload.queue_prefix) {
      setMessage('Cabang, nama poli, kode, dan prefix antrean wajib diisi.')
      return
    }

    if (payload.queue_prefix.length > 3) {
      setMessage('Prefix antrean sebaiknya maksimal 3 karakter.')
      return
    }

    polyclinicMutation.mutate(payload)
  }

  const activeStats = activeTab === 'doctors' ? doctorStats : polyclinicStats

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                void masterDataQuery.refetch()
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          }
          description="Kelola data dasar yang dipakai saat membuat jadwal praktik."
          eyebrow="Master Data"
          title="Dokter & Poli"
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            helper={activeTab === 'doctors' ? 'Data dokter' : 'Data poli'}
            icon={<UsersRound size={20} />}
            label="Total Data"
            tone="teal"
            value={activeStats.total}
          />
          <StatCard
            helper="Siap dipakai"
            icon={<ToggleRight size={22} />}
            label="Aktif"
            tone="emerald"
            value={activeStats.active}
          />
          <StatCard
            helper="Disimpan nonaktif"
            icon={<ToggleLeft size={22} />}
            label="Nonaktif"
            tone="slate"
            value={activeStats.inactive}
          />
        </div>

        <Card className="p-1">
          <div className="grid gap-1 sm:grid-cols-2">
            <TabButton
              active={activeTab === 'doctors'}
              icon={<Stethoscope size={17} />}
              label="Dokter"
              onClick={() => {
                setActiveTab('doctors')
                setMessage(null)
                setSearchTerm('')
                setActivityFilter('all')
              }}
            />
            <TabButton
              active={activeTab === 'polyclinics'}
              icon={<Building2 size={17} />}
              label="Poli"
              onClick={() => {
                setActiveTab('polyclinics')
                setMessage(null)
                setSearchTerm('')
                setActivityFilter('all')
              }}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <Input
                className="pl-10"
                placeholder={
                  activeTab === 'doctors'
                    ? 'Cari dokter, SIP, spesialisasi'
                    : 'Cari poli, kode, prefix'
                }
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              value={activityFilter}
              onChange={(event) =>
                setActivityFilter(
                  event.target.value as 'active' | 'all' | 'inactive',
                )
              }
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </Card>

        {message ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800 shadow-sm shadow-slate-900/5">
            {message}
          </div>
        ) : null}

        {activeTab === 'doctors' ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <DoctorForm
              draft={doctorDraft}
              editing={Boolean(editingDoctorId)}
              loading={doctorMutation.isPending}
              onChange={updateDoctorDraft}
              onReset={() => {
                setMessage(null)
                resetDoctorForm()
              }}
              onSubmit={submitDoctor}
            />
            <DoctorTable
              doctors={filteredDoctors}
              loading={masterDataQuery.isLoading}
              onEdit={startDoctorEdit}
              total={doctors.length}
            />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <PolyclinicForm
              branches={branches}
              draft={polyclinicDraft}
              editing={Boolean(editingPolyclinicId)}
              loading={polyclinicMutation.isPending}
              onChange={updatePolyclinicDraft}
              onReset={() => {
                setMessage(null)
                resetPolyclinicForm()
              }}
              onSubmit={submitPolyclinic}
            />
            <PolyclinicTable
              branches={branches}
              loading={masterDataQuery.isLoading}
              onEdit={startPolyclinicEdit}
              polyclinics={filteredPolyclinics}
              total={polyclinics.length}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function DoctorForm({
  draft,
  editing,
  loading,
  onChange,
  onReset,
  onSubmit,
}: {
  draft: DoctorDraft
  editing: boolean
  loading: boolean
  onChange: (key: keyof DoctorDraft, value: string | boolean) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Card className="p-5">
      <FormHeader
        icon={<Stethoscope size={21} />}
        subtitle="Durasi default akan membantu pengisian jadwal."
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

function PolyclinicForm({
  branches,
  draft,
  editing,
  loading,
  onChange,
  onReset,
  onSubmit,
}: {
  branches: Array<{ id: string; name: string }>
  draft: PolyclinicDraft
  editing: boolean
  loading: boolean
  onChange: (key: keyof PolyclinicDraft, value: string | boolean) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Card className="p-5">
      <FormHeader
        icon={<Building2 size={21} />}
        subtitle="Prefix dipakai untuk nomor antrean pasien."
        title={editing ? 'Edit Poli' : 'Tambah Poli'}
      />
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Cabang">
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            value={draft.branch_id}
            onChange={(event) => onChange('branch_id', event.target.value)}
          >
            <option value="">Pilih cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama poli">
          <Input
            placeholder="Nama poli"
            value={draft.name}
            onChange={(event) => onChange('name', event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode">
            <Input
              placeholder="UMUM"
              value={draft.code}
              onChange={(event) => onChange('code', event.target.value)}
            />
          </Field>
          <Field label="Prefix antrean">
            <Input
              maxLength={3}
              placeholder="U"
              value={draft.queue_prefix}
              onChange={(event) => onChange('queue_prefix', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Deskripsi">
          <textarea
            className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            placeholder="Deskripsi layanan poli"
            value={draft.description}
            onChange={(event) => onChange('description', event.target.value)}
          />
        </Field>
        <ToggleField
          active={draft.is_active}
          label="Status poli"
          onChange={(value) => onChange('is_active', value)}
        />
        <FormActions editing={editing} loading={loading} onReset={onReset} />
      </form>
    </Card>
  )
}

function DoctorTable({
  doctors,
  loading,
  onEdit,
  total,
}: {
  doctors: Doctor[]
  loading: boolean
  onEdit: (doctor: Doctor) => void
  total: number
}) {
  return (
    <Card className="overflow-hidden">
      <TableHeader
        subtitle={`Menampilkan ${doctors.length} dari ${total} dokter.`}
        title="Daftar Dokter"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Dokter</th>
              <th className="px-4 py-3">SIP</th>
              <th className="px-4 py-3">Durasi</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableEmpty colSpan={5} text="Memuat dokter..." />
            ) : doctors.length === 0 ? (
              <TableEmpty colSpan={5} text="Belum ada dokter." />
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
                  <td className="px-4 py-3 font-bold">
                    {doctor.default_service_minutes} menit
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={doctor.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => onEdit(doctor)}>
                        <Pencil size={16} />
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PolyclinicTable({
  branches,
  loading,
  onEdit,
  polyclinics,
  total,
}: {
  branches: Array<{ id: string; name: string }>
  loading: boolean
  onEdit: (polyclinic: Polyclinic) => void
  polyclinics: Polyclinic[]
  total: number
}) {
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name]))

  return (
    <Card className="overflow-hidden">
      <TableHeader
        subtitle={`Menampilkan ${polyclinics.length} dari ${total} poli.`}
        title="Daftar Poli"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Poli</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableEmpty colSpan={5} text="Memuat poli..." />
            ) : polyclinics.length === 0 ? (
              <TableEmpty colSpan={5} text="Belum ada poli." />
            ) : (
              polyclinics.map((polyclinic) => (
                <tr className="transition hover:bg-slate-50/80" key={polyclinic.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{polyclinic.name}</p>
                    <p className="text-xs text-slate-500">
                      {polyclinic.description ?? 'Belum ada deskripsi'}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {branchNameById.get(polyclinic.branch_id) ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-xl bg-teal-50 px-3 py-1 font-black text-teal-700">
                      {polyclinic.queue_prefix}
                    </span>
                    <span className="ml-2 font-bold text-slate-600">
                      {polyclinic.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={polyclinic.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => onEdit(polyclinic)}>
                        <Pencil size={16} />
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
          {active ? 'Data aktif dan bisa dipakai.' : 'Data disimpan sebagai nonaktif.'}
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

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={[
        'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition',
        active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
      ].join(' ')}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
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

function TableEmpty({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-slate-500" colSpan={colSpan}>
        {text}
      </td>
    </tr>
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
