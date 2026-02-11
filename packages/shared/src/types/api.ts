import type { Project, AIAnalysis, GeneratedCopy, TemplateComboItem } from './project.js';
import type { TemplateStyleId } from './template.js';
import type { ExportOptions, ExportResult } from './export.js';

export interface CreateProjectRequest {
  appName: string;
  appDescription?: string;
}

export interface AnalyzeResponse {
  analysis: AIAnalysis;
  generatedCopy: GeneratedCopy;
  recommendedTemplate: TemplateStyleId;
  recommendedCompositionMode?: AIAnalysis['recommendedCompositionMode'];
  recommendedTemplateCombo?: TemplateComboItem[];
}

export interface UpdateProjectRequest {
  appName?: string;
  appDescription?: string;
  templateStyle?: TemplateStyleId;
  generatedCopy?: GeneratedCopy;
}

export type ExportRequest = ExportOptions;

export interface ListProjectsResponse {
  projects: Project[];
  total: number;
}

// Re-export for convenience
export type { Project, AIAnalysis, GeneratedCopy, ExportOptions, ExportResult };
