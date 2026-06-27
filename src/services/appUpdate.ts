import { invoke } from '../platform/electron/core';

export interface AppUpdateAsset {
  name: string;
  url: string;
  size: number;
}

export interface AppUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface AppUpdateStatus {
  platform: string;
  packaged: boolean;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  checking: boolean;
  downloading: boolean;
  downloaded: boolean;
  downloadProgress: AppUpdateProgress | null;
  autoUpdateSupported: boolean;
  autoUpdateChannel: string;
  autoUpdateUnsupportedReason: string;
  canDownload: boolean;
  canInstall: boolean;
  error: string;
  releaseName: string;
  releaseNotes: string;
  releaseDate: string;
  releaseUrl: string;
  assets: AppUpdateAsset[];
  installing?: boolean;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

export async function getAppUpdateStatus(): Promise<AppUpdateStatus> {
  try {
    return await invoke<AppUpdateStatus>('app_update_get_status');
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取软件更新状态失败'));
  }
}

export async function checkForAppUpdate(): Promise<AppUpdateStatus> {
  try {
    return await invoke<AppUpdateStatus>('app_update_check');
  } catch (error) {
    throw new Error(toErrorMessage(error, '检查软件更新失败'));
  }
}

export async function downloadAppUpdate(): Promise<AppUpdateStatus> {
  try {
    return await invoke<AppUpdateStatus>('app_update_download');
  } catch (error) {
    throw new Error(toErrorMessage(error, '下载软件更新失败'));
  }
}

export async function installAppUpdate(): Promise<AppUpdateStatus> {
  try {
    return await invoke<AppUpdateStatus>('app_update_install');
  } catch (error) {
    throw new Error(toErrorMessage(error, '安装软件更新失败'));
  }
}

export async function openAppUpdateReleasePage(): Promise<AppUpdateStatus> {
  try {
    return await invoke<AppUpdateStatus>('app_update_open_release_page');
  } catch (error) {
    throw new Error(toErrorMessage(error, '打开版本下载页失败'));
  }
}
