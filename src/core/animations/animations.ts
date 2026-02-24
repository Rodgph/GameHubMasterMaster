import type { MotionProps, Transition, Variants } from "framer-motion";

// Durações padrão para animações
export const DURATIONS = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  slower: 0.6,
} as const;

// Curvas de easing personalizadas
export const EASINGS = {
  // Suave e natural
  smooth: [0.25, 0.1, 0.25, 1],
  // Entrada suave
  easeIn: [0.42, 0, 1, 1],
  // Saída suave
  easeOut: [0, 0, 0.58, 1],
  // Entrada e saída suaves
  easeInOut: [0.42, 0, 0.58, 1],
  // Mola suave
  spring: [0.68, -0.55, 0.265, 1.55],
  // Desaceleração suave
  decelerate: [0.25, 0.46, 0.45, 0.94],
  // Aceleração suave
  accelerate: [0.55, 0.085, 0.68, 0.53],
} as const;

// Transições reutilizáveis
export const TRANSITIONS: Record<string, Transition> = {
  // Transição rápida e suave
  smooth: { duration: DURATIONS.normal, ease: EASINGS.smooth },
  
  // Transição de mola
  spring: { type: "spring", stiffness: 300, damping: 30 },
  
  // Transição suave com delay
  delayed: { duration: DURATIONS.slow, ease: EASINGS.decelerate, delay: 0.1 },
  
  // Transição rápida para hover
  hover: { duration: DURATIONS.fast, ease: EASINGS.easeOut },
  
  // Transição para modais
  modal: { type: "spring", stiffness: 400, damping: 25 },
  
  // Transição para elementos que entram
  enter: { duration: DURATIONS.normal, ease: EASINGS.easeOut },
  
  // Transição para elementos que saem
  exit: { duration: DURATIONS.fast, ease: EASINGS.easeIn },
};

// Variantes para fade in/out
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Variantes para slide up
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Variantes para slide down
export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

// Variantes para slide left
export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Variantes para slide right
export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// Variantes para scale
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// Variantes para modais
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -10 },
};

// Variantes para tooltips
export const tooltipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.8, y: 4 },
};

// Variantes para mensagens de chat
export const messageVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

// Variantes para lista de itens
export const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: { opacity: 0 },
};

// Variantes para itens individuais de lista
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Variantes para loading skeleton
export const skeletonVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Variantes para pulse (indicador de atividade)
export const pulseVariants: Variants = {
  hidden: { opacity: 0.6 },
  visible: { 
    opacity: 1,
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    },
  },
  exit: { opacity: 0.6 },
};

// Variantes para shake (erro)
export const shakeVariants: Variants = {
  hidden: { x: 0 },
  visible: { 
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 },
  },
  exit: { x: 0 },
};

// Props padrão para animações
export const DEFAULT_MOTION_PROPS: Partial<MotionProps> = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  transition: TRANSITIONS.smooth,
};

// Stagger para animações em cascata
export const STAGGER_CONTAINER_PROPS = {
  variants: listVariants,
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  transition: TRANSITIONS.smooth,
};

// Animações para widgets
export const widgetVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: -20,
    transition: { duration: 0.2 },
  },
};

// Animações para navegação
export const navVariants: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    opacity: 0, 
    x: -50,
    transition: { duration: 0.2 },
  },
};

// Animações para botões
export const buttonVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  hover: { scale: 1.05, transition: TRANSITIONS.hover },
  tap: { scale: 0.95 },
  exit: { opacity: 0, scale: 0.8 },
};

// Animações para cards
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 250,
      damping: 25,
    },
  },
  hover: { 
    y: -4,
    transition: TRANSITIONS.hover,
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};
