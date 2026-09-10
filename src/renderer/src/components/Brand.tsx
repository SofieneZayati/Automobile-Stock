import type { JSX } from 'react'
import type { BusinessSettings } from '../../../shared/contracts'
import { BrandLogo } from './BrandLogo'

export function Brand({
  business
}: {
  business: BusinessSettings | null
}): JSX.Element {
  const companyName = business?.companyName || 'Etablissement Ben Mahmoud'
  const activity = business?.activity || 'Équipement Automobiles'

  return (
    <div className="brand">
      <BrandLogo className="brand-logo" />
      <div className="brand-copy">
        <strong>{companyName.toUpperCase()}</strong>
        <span>{activity}</span>
      </div>
    </div>
  )
}
