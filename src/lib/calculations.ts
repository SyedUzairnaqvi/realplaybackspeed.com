/**
 * Time formatting utilities for the playback speed calculator
 */

/**
 * Parse time string (HH:MM:SS, MM:SS, or seconds) to total seconds
 */
export function parseTimeToSeconds(timeInput: string): number {
  const trimmed = timeInput.trim();
  if (!trimmed) return 0;

  // Handle plain seconds (e.g., "3600" or "3600.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Handle HH:MM:SS or MM:SS format
  const parts = trimmed.split(':').map(p => parseFloat(p));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // Just seconds
    return parts[0];
  }

  return 0;
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
export function formatSeconds(seconds: number, showHours = true): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human readable string (e.g., "1h 30m 45s")
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Calculate playback results
 */
export interface PlaybackResult {
  originalSeconds: number;
  speed: number;
  adjustedSeconds: number;
  timeSaved: number;
  percentageSaved: number;
}

export function calculatePlayback(originalSeconds: number, speed: number): PlaybackResult {
  if (originalSeconds <= 0 || speed <= 0) {
    return {
      originalSeconds,
      speed,
      adjustedSeconds: 0,
      timeSaved: 0,
      percentageSaved: 0,
    };
  }

  const adjustedSeconds = originalSeconds / speed;
  const timeSaved = originalSeconds - adjustedSeconds;
  const percentageSaved = (timeSaved / originalSeconds) * 100;

  return {
    originalSeconds,
    speed,
    adjustedSeconds,
    timeSaved,
    percentageSaved,
  };
}

/**
 * Calculate required speed for target finish time
 */
export interface ReverseResult {
  originalSeconds: number;
  targetSeconds: number;
  requiredSpeed: number;
  isPossible: boolean;
  message?: string;
}

export function calculateRequiredSpeed(originalSeconds: number, targetSeconds: number): ReverseResult {
  if (originalSeconds <= 0 || targetSeconds <= 0) {
    return {
      originalSeconds,
      targetSeconds,
      requiredSpeed: 0,
      isPossible: false,
      message: 'Please enter valid durations',
    };
  }

  const requiredSpeed = originalSeconds / targetSeconds;

  // Practical limits: 0.1x to 16x
  if (requiredSpeed < 0.1) {
    return {
      originalSeconds,
      targetSeconds,
      requiredSpeed,
      isPossible: false,
      message: `Required speed (${requiredSpeed.toFixed(2)}x) is too slow. Minimum practical speed is 0.1x.`,
    };
  }

  if (requiredSpeed > 16) {
    return {
      originalSeconds,
      targetSeconds,
      requiredSpeed,
      isPossible: false,
      message: `Required speed (${requiredSpeed.toFixed(2)}x) is too fast. Maximum practical speed is 16x.`,
    };
  }

  return {
    originalSeconds,
    targetSeconds,
    requiredSpeed,
    isPossible: true,
  };
}

/**
 * Batch calculation for multiple videos
 */
export interface VideoItem {
  id: string;
  title: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export interface BatchResult {
  items: VideoItem[];
  totalOriginalSeconds: number;
  totalAdjustedSeconds: number;
  totalTimeSaved: number;
  averageSpeed: number;
  percentageSaved: number;
}

export function calculateBatch(items: VideoItem[], speed: number): BatchResult {
  const validItems = items.filter(item => item.totalSeconds > 0);
  const totalOriginalSeconds = validItems.reduce((sum, item) => sum + item.totalSeconds, 0);

  if (totalOriginalSeconds === 0 || speed <= 0) {
    return {
      items: validItems,
      totalOriginalSeconds: 0,
      totalAdjustedSeconds: 0,
      totalTimeSaved: 0,
      averageSpeed: speed,
      percentageSaved: 0,
    };
  }

  const totalAdjustedSeconds = totalOriginalSeconds / speed;
  const totalTimeSaved = totalOriginalSeconds - totalAdjustedSeconds;
  const percentageSaved = (totalTimeSaved / totalOriginalSeconds) * 100;

  return {
    items: validItems,
    totalOriginalSeconds,
    totalAdjustedSeconds,
    totalTimeSaved,
    averageSpeed: speed,
    percentageSaved,
  };
}

/**
 * Generate a shareable URL with calculation parameters
 */
export function generateShareUrl(mode: 'standard' | 'reverse' | 'batch', params: Record<string, string | number>): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://realplaybackspeed.com';
  const searchParams = new URLSearchParams();
  searchParams.set('mode', mode);

  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * Parse share URL parameters
 */
export function parseShareUrl(search: string): { mode: string; params: Record<string, string> } | null {
  try {
    const searchParams = new URLSearchParams(search);
    const mode = searchParams.get('mode') || 'standard';
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      if (key !== 'mode') {
        params[key] = value;
      }
    });

    return { mode, params };
  } catch {
    return null;
  }
}

/**
 * Preset speeds for quick selection
 */
export const PRESET_SPEEDS = [1.25, 1.5, 1.75, 2.0, 2.5, 3.0] as const;

/**
 * Keyboard shortcuts configuration
 */
export const KEYBOARD_SHORTCUTS = {
  standard: {
    '1': 1.25,
    '2': 1.5,
    '3': 1.75,
    '4': 2.0,
    '5': 2.5,
    '6': 3.0,
  },
  global: {
    'c': 'copy',
    's': 'share',
    'r': 'reset',
    'tab': 'nextMode',
    'shift+tab': 'prevMode',
  },
} as const;