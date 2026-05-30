import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from './button'

type PaginationProps = {
  currentPage: number
  onPageChange: (page: number) => void
  pageSize: number
  totalItems: number
}

export function Pagination({
  currentPage,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1)
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endItem = Math.min(safePage * pageSize, totalItems)

  if (totalItems <= pageSize) return null

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500">
        Menampilkan {startItem}-{endItem} dari {totalItems} data
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={safePage <= 1}
          variant="secondary"
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={16} />
          Prev
        </Button>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
          {safePage}/{totalPages}
        </span>
        <Button
          disabled={safePage >= totalPages}
          variant="secondary"
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
