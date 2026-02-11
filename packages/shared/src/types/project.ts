import type { CompositionModeId, TemplateStyleId } from './template.js';

export type ProjectStatus = 'draft' | 'analyzing' | 'ready' | 'exporting' | 'completed';

export interface Project {
  id: string;
  appName: string;
  appDescription?: string;
  templateStyle: TemplateStyleId;
  screenshotPaths: string[];
  generatedCopy: GeneratedCopy | null;
  aiAnalysis: AIAnalysis | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysis {
  appType: string;
  keyFeatures: string[];
  colorPalette: string[];
  recommendedTemplate: TemplateStyleId;
  recommendedCompositionMode?: CompositionModeId;
  recommendedTemplateCombo?: TemplateComboItem[];
  confidence: number;
}

export interface TemplateComboItem {
  template: TemplateStyleId;
  compositionMode: CompositionModeId;
  reason: string;
}

export interface GeneratedCopy {
  headlines: CopyVariant[];
  subtitles: CopyVariant[];
  tagline: Record<string, string>;
}

export interface CopyVariant extends Record<string, string | number> {
  screenshotIndex: number;
}
