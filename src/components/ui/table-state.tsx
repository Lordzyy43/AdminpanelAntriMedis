import type { ReactNode } from 'react'

type TableSkeletonRowsProps = {
  columns: number
  rows?: number
}

type TableEmptyStateProps = {
  action?: ReactNode
  colSpan: number
  description: string
  title: string
}

export function TableSkeletonRows({ columns, rows = 5 }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td className="px-4 py-4" key={columnIndex}>
              <div
                className={[
                  'h-4 animate-pulse rounded-full bg-slate-100',
                  columnIndex === 0
                    ? 'w-20'
                    : columnIndex === columns - 1
                      ? 'ml-auto w-24'
                      : 'w-full max-w-[180px]',
                ].join(' ')}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TableEmptyState({
  action,
  colSpan,
  description,
  title,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td className="px-4 py-12 text-center" colSpan={colSpan}>
        <div className="mx-auto max-w-sm">
          <p className="font-black text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
      </td>
    </tr>
  )
}
