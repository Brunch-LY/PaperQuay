import {
  FilePlus2,
  HelpCircle,
  Minus,
  Moon,
  Settings2,
  Square,
  Sun,
  X,
} from 'lucide-react';

type ThemeMode = 'light' | 'dark' | 'system';

export interface ReaderShellHeaderProps {
  l: (zh: string, en: string) => string;
  themeMode: ThemeMode;
  onOpenStandalonePdf: () => void;
  onOpenOnboarding: () => void;
  onOpenPreferences: () => void;
  onCycleThemeMode: () => void;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onWindowClose: () => void;
}

export default function ReaderShellHeader({
  l,
  themeMode,
  onOpenStandalonePdf,
  onOpenOnboarding,
  onOpenPreferences,
  onCycleThemeMode,
  onWindowMinimize,
  onWindowToggleMaximize,
  onWindowClose,
}: ReaderShellHeaderProps) {
  const themeLabel =
    themeMode === 'light'
      ? l('浅色模式', 'Light Mode')
      : themeMode === 'dark'
        ? l('深色模式', 'Dark Mode')
        : l('跟随系统', 'System Theme');

  return (
    <header className="pq-titlebar flex h-10 shrink-0 items-center justify-between pl-3 pr-0">
      <div
        className="flex min-w-0 items-center gap-2"
        data-window-drag-region
        onDoubleClick={onWindowToggleMaximize}
      >
        <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-[var(--pq-radius-sm)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)]">
          <img
            src="/icon.png"
            alt="PaperQuay"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
        <div className="min-w-0 truncate text-[13px] font-semibold leading-none">
          PaperQuay
        </div>
      </div>

      <div
        className="mx-3 min-w-8 flex-1 self-stretch"
        data-window-drag-region
        onDoubleClick={onWindowToggleMaximize}
      />

      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={onOpenStandalonePdf}
          data-tour="open-pdf"
          className="pq-icon-button h-8 w-8 cursor-default"
          title={l('打开 PDF', 'Open PDF')}
          aria-label={l('打开 PDF', 'Open PDF')}
        >
          <FilePlus2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="pq-icon-button h-8 w-8 cursor-default"
          title={l('新手引导', 'Guide')}
          aria-label={l('新手引导', 'Guide')}
        >
          <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onOpenPreferences}
          data-tour="settings"
          className="pq-icon-button h-8 w-8 cursor-default"
          title={l('设置', 'Settings')}
          aria-label={l('设置', 'Settings')}
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onCycleThemeMode}
          className="pq-icon-button h-8 w-8 cursor-default"
          title={themeLabel}
          aria-label={themeLabel}
        >
          {themeMode === 'dark' ? (
            <Moon className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <Sun className="h-4 w-4" strokeWidth={1.8} />
          )}
        </button>
        <div className="ml-1 flex h-full items-center border-l border-[var(--pq-border)]">
          <button
            type="button"
            onClick={onWindowMinimize}
            className="pq-icon-button h-full w-11 cursor-default rounded-none"
            aria-label={l('最小化窗口', 'Minimize Window')}
          >
            <Minus className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={onWindowToggleMaximize}
            className="pq-icon-button h-full w-11 cursor-default rounded-none"
            aria-label={l('切换窗口大小', 'Toggle Window Maximize')}
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={onWindowClose}
            className="pq-icon-button h-full w-11 cursor-default rounded-none hover:bg-[#e81123] hover:text-white"
            aria-label={l('关闭窗口', 'Close Window')}
          >
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </header>
  );
}
