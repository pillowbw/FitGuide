import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/**
 * Soft staggered entrance for a page section's direct children.
 * Respects prefers-reduced-motion.
 */
export function usePageReveal(dependencies = []) {
  const container = useRef(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const targets = gsap.utils.toArray(':scope > *')
        if (!targets.length) return

        gsap.from(targets, {
          opacity: 0,
          y: 22,
          duration: 0.55,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform',
        })
      })
    },
    { scope: container, dependencies, revertOnUpdate: true },
  )

  return container
}
