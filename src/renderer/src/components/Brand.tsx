export function Brand(): JSX.Element {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" role="img">
          <path d="M9 28.8 16.2 8h9.1L35 28.8l-6.2 7.2H15.2L9 28.8Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m14.2 27 7.6-11.8L29.8 27M17.2 31h9.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="brand-copy">
        <strong>BEN MAHMOUD</strong>
        <span>Équipement Automobiles</span>
      </div>
    </div>
  )
}
