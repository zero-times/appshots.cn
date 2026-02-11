import { create } from 'zustand';
import type { GeneratedCopy, AIAnalysis, TemplateStyleId } from '@appshots/shared';

export type WizardStep = 'upload' | 'info' | 'analyzing' | 'preview' | 'export';

interface ProjectData {
  id: string;
  appName: string;
  appDescription?: string;
  templateStyle: TemplateStyleId;
  screenshotPaths: string[];
  generatedCopy: GeneratedCopy | null;
  aiAnalysis: AIAnalysis | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectState {
  currentProject: ProjectData | null;
  uploadedFiles: File[];
  previewUrls: string[];
  wizardStep: WizardStep;
  isAnalyzing: boolean;
  analysisError: string | null;

  setUploadedFiles: (files: File[]) => void;
  setCurrentProject: (project: ProjectData) => void;
  setWizardStep: (step: WizardStep) => void;
  updateCopy: (copy: GeneratedCopy) => void;
  setTemplate: (templateId: TemplateStyleId) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  uploadedFiles: [],
  previewUrls: [],
  wizardStep: 'upload',
  isAnalyzing: false,
  analysisError: null,

  setUploadedFiles: (files) =>
    set((state) => {
      state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      return {
        uploadedFiles: files,
        previewUrls: files.map((f) => URL.createObjectURL(f)),
      };
    }),

  setCurrentProject: (project) => set({ currentProject: project }),

  setWizardStep: (step) => set({ wizardStep: step }),

  updateCopy: (copy) =>
    set((state) => ({
      currentProject: state.currentProject ? { ...state.currentProject, generatedCopy: copy } : null,
    })),

  setTemplate: (templateId) =>
    set((state) => ({
      currentProject: state.currentProject ? { ...state.currentProject, templateStyle: templateId } : null,
    })),

  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setAnalysisError: (error) => set({ analysisError: error }),

  reset: () =>
    set((state) => {
      state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      return {
        currentProject: null,
        uploadedFiles: [],
        previewUrls: [],
        wizardStep: 'upload',
        isAnalyzing: false,
        analysisError: null,
      };
    }),
}));
