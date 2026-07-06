// design/animations.ts
// Modern animation curves and timing for smooth, professional transitions
// Based on Material Design 3 and modern motion design principles

/**
 * Animation durations (in milliseconds)
 */
export const durations = {
  immediate: 0,
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  medium: 400,
  long: 500,
  longer: 700,
  longest: 1000,
} as const;

/**
 * Easing functions - Cubic bezier curves for smooth motion
 */
export const easings = {
  // Standard curves
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Material Design 3 standard curves
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',           // Decelerate
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',           // Ease out
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',           // Ease in
  standard: 'cubic-bezier(0.2, 0.2, 0, 1)',           // Balanced
  
  // Spring-like curves
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  
  // Sharp curves
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
};

/**
 * Animation presets - Ready-to-use configurations
 */
export const animationPresets = {
  // Fade animations
  fadeIn: {
    duration: durations.short,
    easing: easings.easeOut,
    fromOpacity: 0,
    toOpacity: 1,
  },
  fadeOut: {
    duration: durations.short,
    easing: easings.easeIn,
    fromOpacity: 1,
    toOpacity: 0,
  },
  
  // Scale animations
  scaleIn: {
    duration: durations.standard,
    easing: easings.easeOut,
    fromScale: 0.9,
    toScale: 1,
  },
  scaleOut: {
    duration: durations.standard,
    easing: easings.easeIn,
    fromScale: 1,
    toScale: 0.9,
  },
  
  // Slide animations
  slideInUp: {
    duration: durations.standard,
    easing: easings.easeOut,
    fromTranslateY: 100,
    toTranslateY: 0,
  },
  slideOutDown: {
    duration: durations.standard,
    easing: easings.easeIn,
    fromTranslateY: 0,
    toTranslateY: 100,
  },
  slideInLeft: {
    duration: durations.standard,
    easing: easings.easeOut,
    fromTranslateX: -100,
    toTranslateX: 0,
  },
  slideOutRight: {
    duration: durations.standard,
    easing: easings.easeIn,
    fromTranslateX: 0,
    toTranslateX: 100,
  },
  
  // Rotation animations
  rotateIn: {
    duration: durations.standard,
    easing: easings.easeOut,
    fromRotate: -45,
    toRotate: 0,
  },
  rotateOut: {
    duration: durations.standard,
    easing: easings.easeIn,
    fromRotate: 0,
    toRotate: 45,
  },
};

/**
 * Spring animations for physics-based motion
 */
export const springConfigs = {
  // Responsive - Fast and snappy
  responsive: {
    damping: 7,
    mass: 1,
    stiffness: 100,
    overshootClamping: false,
    restSpeedThreshold: 2,
    restDisplacementThreshold: 2,
  },
  
  // Gentle - Smooth and elegant
  gentle: {
    damping: 10,
    mass: 1,
    stiffness: 60,
    overshootClamping: false,
    restSpeedThreshold: 2,
    restDisplacementThreshold: 2,
  },
  
  // Bouncy - Energetic with bounce
  bouncy: {
    damping: 5,
    mass: 1,
    stiffness: 150,
    overshootClamping: false,
    restSpeedThreshold: 2,
    restDisplacementThreshold: 2,
  },
  
  // Stiff - Tight and controlled
  stiff: {
    damping: 15,
    mass: 1,
    stiffness: 200,
    overshootClamping: true,
    restSpeedThreshold: 2,
    restDisplacementThreshold: 2,
  },
};

/**
 * Page transition animations
 */
export const pageTransitions = {
  // Default fade transition
  fade: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
  
  // Slide from right (forward)
  slideRight: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
  
  // Slide from left (backward)
  slideLeft: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
  
  // Scale up from center
  scaleCenter: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
  
  // Modal slide up
  slideUp: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
};

/**
 * Timing combinations for sequences
 */
export const timingSequences = {
  // Quick feedback loop
  quick: [
    { delay: 0, duration: durations.shortest },
    { delay: durations.shortest, duration: durations.shorter },
  ],
  
  // Standard sequence
  standard: [
    { delay: 0, duration: durations.short },
    { delay: durations.short, duration: durations.standard },
  ],
  
  // Choreographed animation
  choreographed: [
    { delay: 0, duration: durations.standard },
    { delay: durations.standard, duration: durations.standard },
    { delay: durations.standard * 2, duration: durations.standard },
  ],
};

/**
 * Gesture animation configs
 */
export const gestureAnimations = {
  // Button press feedback
  buttonPress: {
    duration: durations.shortest,
    toScale: 0.97,
  },
  
  // Swipe response
  swipe: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
  
  // Drag response
  drag: {
    damping: 8,
    mass: 1,
    stiffness: 100,
  },
};

/**
 * Loading animation configs
 */
export const loadingAnimations = {
  // Spinner rotation
  spinner: {
    duration: 1000,
    easing: easings.linear,
  },
  
  // Pulse effect
  pulse: {
    duration: durations.long,
    fromOpacity: 0.3,
    toOpacity: 1,
  },
  
  // Shimmer effect
  shimmer: {
    duration: 1500,
    easing: easings.linear,
  },
};

/**
 * Micro-interaction configs
 */
export const microInteractions = {
  // Ripple effect on tap
  ripple: {
    duration: durations.short,
    easing: easings.easeOut,
  },
  
  // Bounce on notification
  notification: {
    duration: durations.medium,
    easing: easings.bounce,
  },
  
  // Shake for error
  shake: {
    duration: durations.short,
    amplitude: 10,
  },
  
  // Success checkmark
  success: {
    duration: durations.standard,
    easing: easings.easeOut,
  },
};

export default {
  durations,
  easings,
  animationPresets,
  springConfigs,
  pageTransitions,
  timingSequences,
  gestureAnimations,
  loadingAnimations,
  microInteractions,
};