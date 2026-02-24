import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { TRANSITIONS } from "../../../core/animations/animations";

interface PageTransitionProps {
  children: ReactNode;
  isVisible: boolean;
  variant?: "fade" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "scale";
  className?: string;
}

const pageVariants: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 100 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  },
  slideRight: {
    hidden: { opacity: 0, x: -100 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -50 },
  },
  slideDown: {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

export function PageTransition({
  children,
  isVisible,
  variant = "fade",
  className = "",
}: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className={`page-transition ${className}`}
          variants={pageVariants[variant]}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={TRANSITIONS.modal}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
