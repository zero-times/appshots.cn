export type TemplateStyleId =
  | 'clean'
  | 'tech-dark'
  | 'vibrant'
  | 'aurora'
  | 'sunset-glow'
  | 'forest-mist'
  | 'rose-gold'
  | 'monochrome-bold'
  | 'ocean-breeze'
  | 'neon-pulse'
  | 'lavender-dream'
  | 'desert-sand'
  | 'midnight-purple'
  | 'candy-pop';

export type CompositionModeId = 'flow-drift' | 'story-slice';

export interface TemplateConfig {
  id: TemplateStyleId;
  name: string;
  nameZh: string;
  backgroundColor: string | GradientConfig;
  textColor: string;
  subtitleColor: string;
  fontFamily: string;
  fontFamilyZh: string;
  textPosition: 'top' | 'bottom';
  textAlignment: 'left' | 'center';
  deviceFrameStyle: 'silver' | 'dark' | 'none';
  screenshotScale: number;
  compositionMode: CompositionModeId;
  paddingTop: number;
  paddingBottom: number;
}

export interface GradientConfig {
  type: 'linear';
  angle: number;
  stops: Array<{ color: string; position: number }>;
}
