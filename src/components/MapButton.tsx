import type { ButtonHTMLAttributes } from 'react'

export const preventZoom = (el: HTMLElement | null) => {
  if (el) el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })
}

export function MapButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button ref={preventZoom} {...props}>
      {children}
    </button>
  )
}
