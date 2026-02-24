import { motion, type MotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { TRANSITIONS } from "../../../core/animations/animations";

interface AnimatedContainerProps extends Omit<MotionProps, "children"> {
  children: ReactNode;
  variant?: "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "scale" | "modal";
  className?: string;
  delay?: number;
  duration?: number;
}

export function AnimatedContainer({
  children,
  variant = "fade",
  className = "",
  delay = 0,
  duration,
  ...props
}: AnimatedContainerProps) {
  const getVariants = () => {
    switch (variant) {
      case "slideUp":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 },
        };
      case "slideDown":
        return {
          hidden: { opacity: 0, y: -20 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 20 },
        };
      case "slideLeft":
        return {
          hidden: { opacity: 0, x: 20 },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 },
        };
      case "slideRight":
        return {
          hidden: { opacity: 0, x: -20 },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 20 },
        };
      case "scale":
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 },
        };
      case "modal":
        return {
          hidden: { opacity: 0, scale: 0.96, y: -10 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: -10 },
        };
      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          exit: { opacity: 0 },
        };
    }
  };

  const transition = {
    ...TRANSITIONS.smooth,
    delay,
    ...(duration && { duration }),
  };

  return (
    <motion.div
      className={className}
      variants={getVariants()}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transition}
      {...props}
    >
      {children}
    </motion.div>
  );
}
