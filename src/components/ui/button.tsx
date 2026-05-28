import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../../lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

function buttonClassName({
  className,
  variant = 'primary',
}: Pick<ButtonProps, 'className' | 'variant'>) {
  return cn(
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' &&
      'bg-teal-600 text-white shadow-sm shadow-teal-900/20 hover:bg-teal-700',
    variant === 'secondary' &&
      'border border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-900/5 hover:bg-slate-50',
    variant === 'danger' && 'bg-rose-600 text-white shadow-sm shadow-rose-900/15 hover:bg-rose-700',
    variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
    className,
  )
}

export function Button(props: ButtonProps) {
  const {
    className,
    type = 'button',
    variant = 'primary',
    ...buttonProps
  } = props

  return (
    <button
      type={type}
      className={buttonClassName({ className, variant })}
      {...buttonProps}
    />
  )
}

export function LinkButton({
  className,
  to,
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, variant })}
      to={to}
      {...props}
    />
  )
}
