import type { DeviceSize, DeviceSizeId } from '../types/export.js';

export const DEVICE_SIZES: Record<DeviceSizeId, DeviceSize> = {
  '6.5': {
    id: '6.5',
    name: 'iPhone 6.5" (1284x2778 / 1242x2688)',
    width: 1284,
    height: 2778,
    screenArea: { top: 0, left: 0, width: 1284, height: 2778 },
  },
  '13.0': {
    id: '13.0',
    name: 'iPad 13" (2064x2752 / 2048x2732)',
    width: 2064,
    height: 2752,
    screenArea: { top: 0, left: 0, width: 2064, height: 2752 },
  },
  'android-phone': {
    id: 'android-phone',
    name: 'Google Play Phone (1080×1920)',
    width: 1080,
    height: 1920,
    screenArea: { top: 0, left: 0, width: 1080, height: 1920 },
  },
  'android-7': {
    id: 'android-7',
    name: 'Google Play 7-inch (1200×1920)',
    width: 1200,
    height: 1920,
    screenArea: { top: 0, left: 0, width: 1200, height: 1920 },
  },
  'android-10': {
    id: 'android-10',
    name: 'Google Play 10-inch (1600×2560)',
    width: 1600,
    height: 2560,
    screenArea: { top: 0, left: 0, width: 1600, height: 2560 },
  },
};
