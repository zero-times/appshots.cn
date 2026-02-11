import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { api } from '../api/client';
import { StepIndicator } from '../components/wizard/StepIndicator';
import { UploadZone } from '../components/upload/UploadZone';
import { AppInfoForm } from '../components/wizard/AppInfoForm';
import { ProcessingStatus } from '../components/wizard/ProcessingStatus';

export default function Creator() {
  const navigate = useNavigate();
  const {
    uploadedFiles,
    previewUrls,
    wizardStep,
    isAnalyzing,
    analysisError,
    setUploadedFiles,
    setWizardStep,
    setCurrentProject,
    setAnalyzing,
    setAnalysisError,
  } = useProjectStore();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleUploadNext = () => {
    if (uploadedFiles.length >= 3) {
      setWizardStep('info');
    }
  };

  const handleAnalyze = async (nextName = appName, nextDescription = appDescription) => {
    if (isAnalyzing) return;
    const name = nextName.trim();
    const description = nextDescription.trim();
    if (!name) {
      setAnalysisError('请填写应用名称后再开始分析。');
      return;
    }
    if (uploadedFiles.length < 3) {
      setAnalysisError('请至少上传 3 张截图后再开始分析。');
      setWizardStep('upload');
      return;
    }

    try {
      if (mountedRef.current) {
        setAnalyzing(true);
        setAnalysisError(null);
        setWizardStep('analyzing');
      }

      const project = await api.createProject({ appName: name, appDescription: description });
      const id = project.id as string;
      if (mountedRef.current) {
        setProjectId(id);
      }

      await api.uploadScreenshots(id, uploadedFiles);
      await api.analyzeProject(id);

      const fullProject = await api.getProject(id);
      if (mountedRef.current) {
        setCurrentProject(fullProject as never);
        setWizardStep('preview');
        navigate(`/project/${id}`);
      }
    } catch (err) {
      if (mountedRef.current) {
        setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
        setWizardStep('info');
      }
    } finally {
      if (mountedRef.current) {
        setAnalyzing(false);
      }
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="sf-display text-2xl font-bold text-white">创建新项目</h1>
        <p className="mt-1 text-sm text-slate-400">上传截图后，appshots 将自动完成 AI 分析、模板推荐和文案生成。</p>
      </div>

      <div className="sf-card p-6 sm:p-8">
        <StepIndicator current={wizardStep} />

        {wizardStep === 'upload' && (
          <div>
            <h2 className="sf-display text-xl font-semibold text-white">上传 App 截图</h2>
            <p className="mt-1 text-sm text-slate-400">建议上传首页、核心流程和亮点功能页，推荐 3-5 张。</p>

            <div className="mt-6">
              <UploadZone files={uploadedFiles} previewUrls={previewUrls} onFilesChange={setUploadedFiles} />
            </div>

            <div className="mt-6">
              <button onClick={handleUploadNext} disabled={uploadedFiles.length < 3} className="sf-btn-primary">
                下一步：填写应用信息
              </button>
            </div>
          </div>
        )}

        {wizardStep === 'info' && (
          <div>
            <h2 className="sf-display text-xl font-semibold text-white">填写 App 信息</h2>
            <p className="mt-1 text-sm text-slate-400">让 AI 更准确理解你的产品定位。</p>

            <div className="mt-6">
              <AppInfoForm
                appName={appName}
                appDescription={appDescription}
                onNameChange={(value) => {
                  setAppName(value);
                  if (analysisError) setAnalysisError(null);
                }}
                onDescriptionChange={(value) => {
                  setAppDescription(value);
                  if (analysisError) setAnalysisError(null);
                }}
                onSubmit={() => handleAnalyze()}
                isLoading={isAnalyzing}
                error={analysisError}
              />
            </div>

            <button onClick={() => setWizardStep('upload')} className="sf-btn-ghost mt-4">
              返回上一步
            </button>
          </div>
        )}

        {wizardStep === 'analyzing' && <ProcessingStatus error={analysisError} />}

        {projectId && wizardStep === 'analyzing' && (
          <p className="mt-4 text-center text-xs text-slate-500">项目 ID：{projectId}</p>
        )}
      </div>
    </div>
  );
}
