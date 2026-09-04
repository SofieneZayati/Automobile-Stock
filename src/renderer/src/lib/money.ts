export function formatTnd(millimes: number, locale = 'fr-TN'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(millimes / 1000) + ' DT'
}

export function lineTotal(qty: number, unitPriceMillimes: number): number {
  return qty * unitPriceMillimes
}

export function percentageAmount(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100)
}
