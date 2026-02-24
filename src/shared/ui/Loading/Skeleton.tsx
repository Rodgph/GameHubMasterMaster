import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { skeletonVariants, pulseVariants } from "../../../core/animations/animations";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  lines?: number;
  animated?: boolean;
}

export function Skeleton({
  width = "100%",
  height = 20,
  className = "",
  variant = "rectangular",
  lines = 1,
  animated = true,
}: SkeletonProps) {
  const getVariantClasses = () => {
    const classes = ["skeleton"];
    
    switch (variant) {
      case "text":
        classes.push("skeleton--text");
        break;
      case "circular":
        classes.push("skeleton--circular");
        break;
      case "rounded":
        classes.push("skeleton--rounded");
        break;
      default:
        classes.push("skeleton--rectangular");
    }
    
    return classes.join(" ");
  };

  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className={`skeleton-text-container ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <motion.div
            key={i}
            className={getVariantClasses()}
            style={{
              ...style,
              width: i === lines - 1 ? "70%" : "100%", // Last line shorter
              marginBottom: i < lines - 1 ? "8px" : "0",
            }}
            variants={animated ? pulseVariants : skeletonVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={`${getVariantClasses()} ${className}`}
      style={style}
      variants={animated ? pulseVariants : skeletonVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    />
  );
}

interface SkeletonCardProps {
  className?: string;
  children?: ReactNode;
}

export function SkeletonCard({ className = "", children }: SkeletonCardProps) {
  return (
    <div className={`skeleton-card ${className}`}>
      <div className="skeleton-card__header">
        <Skeleton width={40} height={40} variant="circular" />
        <div className="skeleton-card__header-text">
          <Skeleton width={120} height={16} variant="text" />
          <Skeleton width={80} height={12} variant="text" />
        </div>
      </div>
      <div className="skeleton-card__content">
        {children || (
          <>
            <Skeleton width="100%" height={12} variant="text" lines={3} />
          </>
        )}
      </div>
    </div>
  );
}

interface SkeletonListProps {
  items?: number;
  className?: string;
}

export function SkeletonList({ items = 5, className = "" }: SkeletonListProps) {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: items }, (_, i) => (
        <SkeletonCard key={i} className="skeleton-list__item" />
      ))}
    </div>
  );
}
