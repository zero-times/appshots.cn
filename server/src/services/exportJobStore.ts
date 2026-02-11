import { nanoid } from 'nanoid';

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ExportJobStage = 'queued' | 'preparing' | 'rendering' | 'packaging' | 'saving' | 'completed' | 'failed';

export interface ExportJob {
  jobId: string;
  projectId: string;
  ownerSessionId: string;
  status: ExportJobStatus;
  stage: ExportJobStage;
  progress: number;
  message: string;
  zipUrl?: string;
  fileCount?: number;
  totalSizeBytes?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

type ExportJobListener = (job: ExportJob) => void;

const EXPORT_JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map<string, ExportJob>();
const listeners = new Map<string, Set<ExportJobListener>>();

function nowIso(): string {
  return new Date().toISOString();
}

function shouldPurge(job: ExportJob): boolean {
  const updatedAtMs = Date.parse(job.updatedAt);
  if (Number.isNaN(updatedAtMs)) return false;
  return Date.now() - updatedAtMs > EXPORT_JOB_TTL_MS;
}

function removeJob(jobId: string): void {
  jobs.delete(jobId);
  listeners.delete(jobId);
}

function purgeExpiredJobs(): void {
  for (const [jobId, job] of jobs) {
    if (shouldPurge(job)) {
      removeJob(jobId);
    }
  }
}

function publish(job: ExportJob): void {
  const subscriptions = listeners.get(job.jobId);
  if (!subscriptions || subscriptions.size === 0) return;

  for (const listener of subscriptions) {
    listener(job);
  }

  if (job.status === 'completed' || job.status === 'failed') {
    listeners.delete(job.jobId);
  }
}

export function subscribeExportJob(jobId: string, listener: ExportJobListener): () => void {
  const current = listeners.get(jobId);
  if (current) {
    current.add(listener);
  } else {
    listeners.set(jobId, new Set([listener]));
  }

  return () => {
    const target = listeners.get(jobId);
    if (!target) return;

    target.delete(listener);
    if (target.size === 0) {
      listeners.delete(jobId);
    }
  };
}

export function createExportJob(projectId: string, ownerSessionId: string): ExportJob {
  purgeExpiredJobs();

  const timestamp = nowIso();
  const job: ExportJob = {
    jobId: nanoid(12),
    projectId,
    ownerSessionId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    message: '导出任务已创建，等待处理...',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  jobs.set(job.jobId, job);
  publish(job);
  return job;
}

export function getExportJob(jobId: string): ExportJob | undefined {
  purgeExpiredJobs();
  return jobs.get(jobId);
}

export function updateExportJob(
  jobId: string,
  patch: Partial<Omit<ExportJob, 'jobId' | 'projectId' | 'ownerSessionId' | 'createdAt'>>,
): ExportJob | undefined {
  const current = jobs.get(jobId);
  if (!current) return undefined;

  const next: ExportJob = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };

  jobs.set(jobId, next);
  publish(next);
  return next;
}

export function completeExportJob(
  jobId: string,
  data: { zipUrl: string; fileCount: number; totalSizeBytes: number; message?: string },
): ExportJob | undefined {
  return updateExportJob(jobId, {
    status: 'completed',
    stage: 'completed',
    progress: 100,
    message: data.message || '导出完成，可下载文件。',
    zipUrl: data.zipUrl,
    fileCount: data.fileCount,
    totalSizeBytes: data.totalSizeBytes,
    error: undefined,
  });
}

export function failExportJob(jobId: string, error: string): ExportJob | undefined {
  return updateExportJob(jobId, {
    status: 'failed',
    stage: 'failed',
    message: '导出失败，请重试。',
    error,
  });
}
