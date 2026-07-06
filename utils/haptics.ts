// utils/haptics.ts
// Haptic feedback utilities for consistent touch feedback across the app
// These are no-op functions since expo-haptics is not installed
// They can be replaced with actual haptic feedback when needed

/**
 * Trigger a light selection haptic feedback (used for button presses, etc.)
 */
export const triggerSelection = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger a light impact haptic feedback
 */
export const triggerLight = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger a medium impact haptic feedback
 */
export const triggerMedium = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger a heavy impact haptic feedback
 */
export const triggerHeavy = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger a success notification haptic feedback
 */
export const triggerSuccess = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger a warning notification haptic feedback
 */
export const triggerWarning = async (): Promise<void> => {
  // No-op - haptics not available
};

/**
 * Trigger an error notification haptic feedback
 */
export const triggerError = async (): Promise<void> => {
  // No-op - haptics not available
};

export default {
  triggerSelection,
  triggerLight,
  triggerMedium,
  triggerHeavy,
  triggerSuccess,
  triggerWarning,
  triggerError,
};
