import { motion, AnimatePresence, type MotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { listVariants, listItemVariants, TRANSITIONS } from "../../../core/animations/animations";

interface AnimatedListProps extends Omit<MotionProps, "children"> {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function AnimatedList({
  children,
  className = "",
  staggerDelay = 0.05,
  direction: _direction = "up",
  ...props
}: AnimatedListProps) {
  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      }}
      {...props}
    >
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.div>
  );
}

interface AnimatedListItemProps extends Omit<MotionProps, "children"> {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function AnimatedListItem({
  children,
  className = "",
  delay = 0,
  direction = "up",
  ...props
}: AnimatedListItemProps) {
  const getVariants = () => {
    switch (direction) {
      case "down":
        return {
          hidden: { opacity: 0, y: -10 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 10 },
        };
      case "left":
        return {
          hidden: { opacity: 0, x: 10 },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -10 },
        };
      case "right":
        return {
          hidden: { opacity: 0, x: -10 },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 10 },
        };
      default:
        return listItemVariants;
    }
  };

  return (
    <motion.div
      className={className}
      variants={getVariants()}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{
        ...TRANSITIONS.smooth,
        delay,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
