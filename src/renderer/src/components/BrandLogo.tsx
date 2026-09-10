import type { JSX } from 'react'
import brandIcon from '../assets/brand-icon.png'

export function BrandLogo({ className }: { className: string }): JSX.Element {
  return (
    <img
      className={className}
      src={brandIcon}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
