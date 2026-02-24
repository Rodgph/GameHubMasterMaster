import { motion, type MotionProps } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonVariants, TRANSITIONS } from "../../../core/animations/animations";

interface AnimatedButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  animation?: "scale" | "bounce" | "none";
  className?: string;
  disabled?: boolean;
}

export function AnimatedButton({
  children,
  variant = "primary",
  size = "md",
  animation = "scale",
  className = "",
  disabled = false,
  ...props
}: AnimatedButtonProps) {
  const getBaseClasses = () => {
    const classes = ["animated-button"];
    
    // Variant styles
    switch (variant) {
      case "secondary":
        classes.push("animated-button--secondary");
        break;
      case "ghost":
        classes.push("animated-button--ghost");
        break;
      default:
        classes.push("animated-button--primary");
    }
    
    // Size styles
    switch (size) {
      case "sm":
        classes.push("animated-button--sm");
        break;
      case "lg":
        classes.push("animated-button--lg");
        break;
      default:
        classes.push("animated-button--md");
    }
    
    if (disabled) {
      classes.push("animated-button--disabled");
    }
    
    return classes.join(" ");
  };

  const getMotionProps = () => {
    if (animation === "none" || disabled) {
      return {};
    }

    return {
      variants: buttonVariants,
      whileHover: { scale: 1.05 },
      whileTap: { scale: 0.95 },
      transition: TRANSITIONS.hover,
    };
  };

  return (
    <motion.button
      className={`${getBaseClasses()} ${className}`}
      disabled={disabled}
      {...getMotionProps()}
      {...props}
    >
      {children}
    </motion.button>
  );
}
