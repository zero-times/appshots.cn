export type DeviceSizeId =
  | '6.7'
  | '6.1'
  | '5.5'
  | '11.0'
  | '12.9'
  | 'android-phone'
  | 'android-7'
  | 'android-10';

export interface DeviceSize {
  id: DeviceSizeId;
  name: string;
  width: number;
  height: number;
  screenArea: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface ExportOptions {
  projectId: string;
  deviceSizes: DeviceSizeId[];
  // Deprecated legacy field kept for backward compatibility.
  language?: 'zh' | 'en' | 'both';
  // Preferred multilingual field.
  languages?: string[];
  includeWatermark?: boolean;
  watermarkText?: string;
  format: 'png';
}

export interface ExportResult {
  zipUrl: string;
  fileCount: number;
  totalSizeBytes: number;
}
