import type { DeviceSize, DeviceSizeId } from '../types/export.js';

export const DEVICE_SIZES: Record<DeviceSizeId, DeviceSize> = {
  '6.7': {
    id: '6.7',
    name: 'iPhone 16 Pro Max (6.7")',
    width: 1290,
    height: 2796,
    screenArea: { top: 0, left: 0, width: 1290, height: 2796 },
  },
  '6.1': {
    id: '6.1',
    name: 'iPhone 16 / 15 (6.1")',
    width: 1179,
    height: 2556,
    screenArea: { top: 0, left: 0, width: 1179, height: 2556 },
  },
  '5.5': {
    id: '5.5',
    name: 'iPhone 8 Plus (5.5")',
    width: 1242,
    height: 2208,
    screenArea: { top: 0, left: 0, width: 1242, height: 2208 },
  },
  '11.0': {
    id: '11.0',
    name: 'iPad Pro (11")',
    width: 1668,
    height: 2388,
    screenArea: { top: 0, left: 0, width: 1668, height: 2388 },
  },
  '12.9': {
    id: '12.9',
    name: 'iPad Pro (12.9")',
    width: 2048,
    height: 2732,
    screenArea: { top: 0, left: 0, width: 2048, height: 2732 },
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
