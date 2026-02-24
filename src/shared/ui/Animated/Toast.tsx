import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import type { Variants } from "framer-motion";
import { TRANSITIONS } from "../../../core/animations/animations";

interface ToastProps {
  id: string;
  isVisible: boolean;
  title?: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -50,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    }
  },
  exit: {
    opacity: 0,
    y: -50,
    scale: 0.95,
    transition: { duration: 0.2 }
  },
};

export function Toast({
  id: _id,
  isVisible,
  title,
  message,
  type = "info",
  duration: _duration = 5000,
  onClose,
  action,
}: ToastProps) {
  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "toast--success";
      case "error":
        return "toast--error";
      case "warning":
        return "toast--warning";
      default:
        return "toast--info";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      default:
        return "ℹ";
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`toast ${getTypeStyles()}`}
          variants={toastVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
        >
          <div className="toast__icon">
            {getIcon()}
          </div>
          <div className="toast__content">
            {title && <div className="toast__title">{title}</div>}
            <div className="toast__message">{message}</div>
          </div>
          {action && (
            <motion.button
              className="toast__action"
              onClick={action.onClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={TRANSITIONS.hover}
            >
              {action.label}
            </motion.button>
          )}
          {onClose && (
            <motion.button
              className="toast__close"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={TRANSITIONS.hover}
            >
              ×
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ToastContainerProps {
  children: ReactNode;
}

export function ToastContainer({ children }: ToastContainerProps) {
  return (
    <div className="toast-container">
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}
