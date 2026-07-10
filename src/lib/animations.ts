import type { Transition } from "framer-motion"

const base: Transition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
const fast: Transition = { duration: 0.15, ease: "easeOut" }
const springy: Transition = { type: "spring", stiffness: 400, damping: 30 }

export const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: base } }
export const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: base } }
export const fadeDown = { hidden: { opacity: 0, y: -8 }, visible: { opacity: 1, y: 0, transition: fast } }
export const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: springy } }
export const pageTransition = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.15 } } }

export const modalTransition = {
  backdrop: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: fast } },
  dialog: { hidden: { opacity: 0, scale: 0.95, y: 8 }, visible: { opacity: 1, scale: 1, y: 0, transition: springy } },
}

export const cardHover = { whileHover: { y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }, whileTap: { scale: 0.99 }, transition: { duration: 0.15 } }
export const buttonPress = { whileTap: { scale: 0.97 }, transition: { duration: 0.1 } }

export function listStagger(delay = 0.04, duration = 0.15) {
  return { hidden: { opacity: 0, y: 8 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * delay, duration, ease: "easeOut" } }) }
}

export function tableRowAnimation(i: number) {
  return { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { delay: Math.min(i * 0.03, 0.3), duration: 0.12 } }
}
