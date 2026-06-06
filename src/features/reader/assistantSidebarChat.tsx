import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  Camera,
  ChevronDown,
  Code2,
  Database,
  ExternalLink,
  FilePlus2,
  ImagePlus,
  Loader2,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Quote,
  X,
} from 'lucide-react';
import { useWheelScrollDelegate } from '../../hooks/useWheelScrollDelegate';
import { useLocaleText } from '../../i18n/uiLanguage';
import { ModelPresetPicker } from '../../components/ModelPresetPicker';
import { ReasoningEffortPicker } from '../../components/ReasoningEffortPicker';
import type {
  DocumentChatAttachment,
  DocumentChatCitation,
  DocumentChatMessage,
  DocumentChatRenderMode,
  DocumentChatSession,
  ModelReasoningEffort,
  QaModelPreset,
  SelectedExcerpt,
} from '../../types/reader';
import { cn } from '../../utils/cn';
import { formatFileSize } from '../../utils/files';
import { cleanQaAssistantOutput } from '../../utils/qaOutput';
import { MarkdownPreview, SectionCard } from './assistantSidebarPrimitives';
import {
  formatQaContextBadge,
  formatQaContextHint,
  getQaContextBadgeTone,
} from './readerQaContext';

function formatChatSessionTime(timestamp: number, locale: 'zh-CN' | 'en-US') {
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
}

function buildCitationHref(label: string): string {
  return `#cite-${label}`;
}

function injectCitationLinks(
  content: string,
  citations: DocumentChatCitation[] | undefined,
): string {
  if (!content.trim() || !citations || citations.length === 0) {
    return content;
  }

  const labels = new Set(citations.map((citation) => citation.label));
  const normalizedContent = content
    .replace(/\[(\d+(?:\s*[,?]\s*\d+)+)\]/g, (_match, group: string) =>
      group
        .split(/\s*[,?]\s*/)
        .map((label) => `[${label}]`)
        .join(' '),
    )
    .replace(/\](?=\[\d+\])/g, '] ');

  return normalizedContent.replace(/\[(\d+)\](?!\()/g, (match, label: string) => {
    if (!labels.has(label)) {
      return match;
    }

    return `[${label}](${buildCitationHref(label)})`;
  });
}

function normalizeCitationHref(href: string): string {
  const trimmed = href.trim();

  if (trimmed.startsWith('#cite-')) {
    return trimmed;
  }

  if (trimmed.startsWith('cite:')) {
    return `#cite-${trimmed.slice('cite:'.length)}`;
  }

  if (trimmed.startsWith('%23cite-')) {
    return decodeURIComponent(trimmed);
  }

  if (trimmed.startsWith('cite%3A')) {
    return `#cite-${decodeURIComponent(trimmed).slice('cite:'.length)}`;
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function findCitationByHref(
  href: string,
  citations: DocumentChatCitation[] | undefined,
): DocumentChatCitation | null {
  if (!citations || citations.length === 0) {
    return null;
  }

  const normalizedHref = normalizeCitationHref(href);
  const labelMatch = normalizedHref.match(/^#cite-(\d+)$/);

  if (!labelMatch) {
    return null;
  }

  const label = labelMatch[1];

  return (
    citations.find((citation) => citation.label === label) ??
    citations.find((citation) => citation.id === `cite:${label}`) ??
    null
  );
}

function hasInlineCitationLinks(content: string): boolean {
  return /\[\d+\]\(#cite-\d+\)/.test(content);
}

function stripHtmlFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);

  if (fenced) {
    return fenced[1].trim();
  }

  const firstFence = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);

  if (firstFence && trimmed.replace(firstFence[0], '').trim().length === 0) {
    return firstFence[1].trim();
  }

  return trimmed
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function findRawHtmlFragmentBounds(content: string): { start: number; end: number } | null {
  const startMatch = content.match(
    /<(div|section|article|main|aside|figure|figcaption|details|summary|svg|table|ul|ol|p|h[1-6])(?=[\s>/]|(?:style|id|role|aria-|data-|class|width|height|viewBox)=)[^>]*>/i,
  );

  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const tagName = startMatch[1].toLowerCase();
  const tagPattern = new RegExp(
    `</?${tagName}(?=[\\s>/]|(?:style|id|role|aria-|data-|class|width|height|viewBox)=)[^>]*>`,
    'gi',
  );
  tagPattern.lastIndex = startMatch.index;

  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(content)) !== null) {
    const tag = match[0];
    const closing = /^<\s*\//.test(tag);
    const selfClosing = /\/\s*>$/.test(tag);

    if (closing) {
      depth -= 1;
    } else if (!selfClosing) {
      depth += 1;
    }

    if (depth <= 0) {
      return {
        start: startMatch.index,
        end: match.index + tag.length,
      };
    }
  }

  return {
    start: startMatch.index,
    end: content.length,
  };
}

type HtmlAnswerSegment =
  | {
      kind: 'markdown';
      content: string;
    }
  | {
      kind: 'html';
      content: string;
    };

function appendMarkdownSegment(segments: HtmlAnswerSegment[], content: string) {
  const trimmed = content.trim();

  if (trimmed) {
    segments.push({ kind: 'markdown', content: trimmed });
  }
}

function appendHtmlSegment(segments: HtmlAnswerSegment[], content: string) {
  const trimmed = normalizeHtmlFragment(content);

  if (trimmed) {
    segments.push({ kind: 'html', content: trimmed });
  }
}

function normalizeHtmlFragment(content: string): string {
  let html = stripHtmlFences(content)
    .replace(/^(?:html|htm)\s*(?=<)/i, '')
    .trim();

  html = html.replace(
    /<(\/?)(div|section|article|main|aside|figure|figcaption|details|summary|svg|table|thead|tbody|tr|td|th|ul|ol|li|p|h[1-6]|span|strong|em|small)(?=(?:style|id|role|aria-|data-|class|width|height|viewBox)=)/gi,
    '<$1$2 ',
  );

  return html;
}

function parseCodeFence(content: string): {
  fenceStart: number;
  contentStart: number;
  contentEnd: number;
  fenceEnd: number;
  language: string;
} | null {
  const fenceMatch = content.match(/```+/);

  if (!fenceMatch || fenceMatch.index === undefined) {
    return null;
  }

  const fence = fenceMatch[0];
  const fenceStart = fenceMatch.index;
  let cursor = fenceStart + fence.length;

  while (content[cursor] === ' ' || content[cursor] === '\t') {
    cursor += 1;
  }

  const languageMatch = content.slice(cursor).match(/^([a-zA-Z0-9_-]+)/);
  const language = (languageMatch?.[1] ?? '').trim().toLowerCase();

  if (languageMatch) {
    cursor += languageMatch[0].length;
  }

  while (content[cursor] === ' ' || content[cursor] === '\t') {
    cursor += 1;
  }

  let contentStart = cursor;
  const newlineMatch = content.slice(cursor).match(/^\r?\n/);

  if (newlineMatch) {
    contentStart = cursor + newlineMatch[0].length;
  }

  const closingIndex = content.indexOf(fence, contentStart);
  const contentEnd = closingIndex >= 0 ? closingIndex : content.length;
  const fenceEnd = closingIndex >= 0 ? closingIndex + fence.length : content.length;

  return {
    fenceStart,
    contentStart,
    contentEnd,
    fenceEnd,
    language,
  };
}

function isHtmlFence(language: string, content: string): boolean {
  if (language === 'html' || language === 'htm') {
    return true;
  }

  if (language) {
    return false;
  }

  return Boolean(findRawHtmlFragmentBounds(content.trim()));
}

function parseHtmlAnswerSegments(content: string): HtmlAnswerSegment[] {
  const segments: HtmlAnswerSegment[] = [];
  let rest = content.trim();

  while (rest) {
    const fence = parseCodeFence(rest);
    const fenceIndex = fence?.fenceStart ?? -1;
    const rawHtmlBounds = findRawHtmlFragmentBounds(rest);
    const rawHtmlIndex = rawHtmlBounds?.start ?? -1;

    if (fence && fenceIndex >= 0 && (rawHtmlIndex < 0 || fenceIndex <= rawHtmlIndex)) {
      appendMarkdownSegment(segments, rest.slice(0, fenceIndex));

      if (isHtmlFence(fence.language, rest.slice(fence.contentStart, fence.contentEnd))) {
        appendHtmlSegment(segments, rest.slice(fence.contentStart, fence.contentEnd));
      } else {
        appendMarkdownSegment(segments, rest.slice(fence.fenceStart, fence.fenceEnd));
      }

      rest = rest.slice(fence.fenceEnd).trimStart();
      continue;
    }

    if (rawHtmlBounds) {
      appendMarkdownSegment(segments, rest.slice(0, rawHtmlBounds.start));
      appendHtmlSegment(segments, rest.slice(rawHtmlBounds.start, rawHtmlBounds.end));
      rest = rest.slice(rawHtmlBounds.end).trimStart();
      continue;
    }

    appendMarkdownSegment(segments, rest);
    break;
  }

  return segments;
}

function containsRenderableHtml(content: string): boolean {
  return parseHtmlAnswerSegments(content).some((segment) => segment.kind === 'html');
}

function shouldRenderHtmlAnswerPreview(content: string): boolean {
  const trimmed = content.trim();

  if (!trimmed) {
    return false;
  }

  return (
    containsRenderableHtml(trimmed) ||
    /```+[ \t]*(?:html|htm)\b/i.test(trimmed) ||
    /```+[ \t]*<(?:div|section|article|main|aside|figure|details|summary|svg|table|ul|ol|p|h[1-6])(?=[\s>/]|(?:style|id|role|aria-|data-|class|width|height|viewBox)=)/i.test(
      trimmed,
    )
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function buildSandboxHtml(fragment: string): string {
  const html = normalizeHtmlFragment(fragment);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:;" />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.65;
        color: #0f172a;
        background: transparent;
      }
      * { box-sizing: border-box; }
      html {
        margin: 0;
        padding: 0;
        min-width: 0;
        overflow: hidden;
        background: transparent;
      }
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-width: 0;
        overflow: hidden;
        overflow-wrap: break-word;
        word-break: normal;
        background: transparent;
      }
      body > * {
        width: 100% !important;
        max-width: 100% !important;
      }
      body > *:first-child { margin-top: 0 !important; }
      body > *:last-child { margin-bottom: 0 !important; }
      div, section, article, aside, figure, figcaption, details, summary {
        min-width: 0;
      }
      [style*="display:flex"],
      [style*="display: flex"],
      [style*="display:inline-flex"],
      [style*="display: inline-flex"] {
        max-width: 100%;
        min-width: 0;
        flex-wrap: wrap !important;
      }
      [style*="display:flex"] > *,
      [style*="display: flex"] > *,
      [style*="display:inline-flex"] > *,
      [style*="display: inline-flex"] > * {
        min-width: min(100%, 180px);
        max-width: 100%;
      }
      [style*="display:grid"],
      [style*="display: grid"] {
        max-width: 100%;
        min-width: 0;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)) !important;
      }
      h1, h2, h3, h4 { margin: 1.1em 0 0.55em; line-height: 1.25; color: #0f172a; }
      h1 { font-size: 1.35rem; }
      h2 { font-size: 1.15rem; }
      h3 { font-size: 1rem; }
      p, ul, ol, blockquote, table, pre { margin: 0.75em 0; }
      ul, ol { padding-left: 1.35rem; }
      a { color: #0d9488; }
      table { width: 100%; border-collapse: collapse; overflow: hidden; }
      th, td { border: 1px solid #e7e5e4; padding: 8px 10px; vertical-align: top; }
      th { background: #f5f5f4; text-align: left; font-weight: 650; }
      code { border-radius: 6px; background: #f5f5f4; padding: 0.1rem 0.35rem; color: #0f766e; }
      pre {
        max-width: 100%;
        overflow-x: auto;
        border-radius: 14px;
        background: #0f172a;
        padding: 12px;
        color: #e2e8f0;
      }
      pre code { background: transparent; color: inherit; padding: 0; }
      blockquote {
        border-left: 4px solid #99f6e4;
        background: #f0fdfa;
        padding: 10px 12px;
        color: #334155;
      }
      img, svg, canvas, video { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

function HtmlAnswerFrame({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(180);
  const debouncedContent = useDebouncedValue(content, 80);
  const srcDoc = useMemo(() => buildSandboxHtml(debouncedContent), [debouncedContent]);

  const resizeFrame = () => {
    const iframe = iframeRef.current;
    const documentElement = iframe?.contentDocument?.documentElement;
    const body = iframe?.contentDocument?.body;

    if (!documentElement || !body) {
      return;
    }

    const nextHeight = Math.ceil(
      Math.max(documentElement.scrollHeight, body.scrollHeight, documentElement.offsetHeight, body.offsetHeight) + 4,
    );

    if (Number.isFinite(nextHeight)) {
      const clampedHeight = Math.max(120, nextHeight);
      setHeight((currentHeight) =>
        Math.abs(currentHeight - clampedHeight) > 2 ? clampedHeight : currentHeight,
      );
    }
  };

  useEffect(() => {
    const firstFrame = window.requestAnimationFrame(resizeFrame);
    const secondFrame = window.setTimeout(resizeFrame, 80);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(secondFrame);
    };
  }, [debouncedContent]);

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain">
      <iframe
        ref={iframeRef}
        title="HTML answer preview"
        sandbox="allow-same-origin"
        scrolling="no"
        srcDoc={srcDoc}
        onLoad={resizeFrame}
        className="block w-full border-0 bg-transparent"
        style={{
          height,
          width: '100%',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

function HtmlAnswerPreview({ content }: { content: string }) {
  const l = useLocaleText();
  const segments = useMemo(() => parseHtmlAnswerSegments(content), [content]);

  if (segments.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--pq-accent-border)] bg-[var(--pq-accent-bg)] px-3 py-2 text-xs leading-5 text-[var(--pq-accent)]">
        {l('正在生成可视化回答...', 'Generating visual preview...')}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      {segments.map((segment, index) =>
        segment.kind === 'html' ? (
          <HtmlAnswerFrame key={`html-${index}`} content={segment.content} />
        ) : (
          <MarkdownPreview
            key={`markdown-${index}`}
            content={segment.content}
            className="text-sm leading-7"
          />
        ),
      )}
    </div>
  );
}

const CHAT_HISTORY_PANEL_WIDTH_STORAGE_KEY = 'paperquay.chat-history-panel-width';
const MIN_CHAT_HISTORY_PANEL_WIDTH = 120;
const MAX_CHAT_HISTORY_PANEL_WIDTH = 520;
const MIN_CHAT_CONTENT_PANEL_WIDTH = 160;
const CHAT_COMPOSER_COMPACT_WIDTH = 540;
const CHAT_COMPOSER_ULTRA_COMPACT_WIDTH = 360;
const CHAT_COMPOSER_MAX_TEXTAREA_HEIGHT = 240;
const CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD = 96;

function isNearScrollBottom(element: HTMLElement, threshold = CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function loadStoredPanelWidth(key: string, fallback: number) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  const parsed = stored ? Number(stored) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ChatWorkspacePanelProps {
  sessions: DocumentChatSession[];
  selectedSessionId: string;
  messages: DocumentChatMessage[];
  input: string;
  loading: boolean;
  error: string;
  hasBlocks: boolean;
  selectedExcerpt: SelectedExcerpt | null;
  attachments: DocumentChatAttachment[];
  qaModelPresets: QaModelPreset[];
  selectedQaPresetId: string;
  qaRagEnabled: boolean;
  qaAnswerRenderMode: DocumentChatRenderMode;
  qaReasoningEffort: ModelReasoningEffort;
  screenshotLoading: boolean;
  assistantDetached?: boolean;
  layoutMode?: 'compact' | 'workspace';
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onQaPresetChange: (presetId: string) => void;
  onQaRagEnabledChange: (value: boolean) => void;
  onQaAnswerRenderModeChange: (mode: DocumentChatRenderMode) => void;
  onQaReasoningEffortChange: (reasoningEffort: ModelReasoningEffort) => void;
  onSessionCreate: () => void;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onAppendSelectedExcerpt: () => void;
  onSelectImageAttachments: () => void;
  onSelectFileAttachments: () => void;
  onCaptureScreenshot: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onDetachAssistant?: () => void;
  onAttachAssistant?: () => void;
  onCollapseSidebar?: () => void;
  onCitationClick?: (citation: DocumentChatCitation) => void;
  onSaveAssistantMessageAsNote?: (message: DocumentChatMessage) => void;
}

export function ChatWorkspacePanel({
  sessions,
  selectedSessionId,
  messages,
  input,
  loading,
  error,
  hasBlocks,
  selectedExcerpt,
  attachments,
  qaModelPresets,
  selectedQaPresetId,
  qaRagEnabled,
  qaAnswerRenderMode,
  qaReasoningEffort,
  screenshotLoading,
  assistantDetached = false,
  layoutMode = 'compact',
  onInputChange,
  onSubmit,
  onQaPresetChange,
  onQaRagEnabledChange,
  onQaAnswerRenderModeChange,
  onQaReasoningEffortChange,
  onSessionCreate,
  onSessionSelect,
  onSessionDelete,
  onAppendSelectedExcerpt,
  onSelectImageAttachments,
  onSelectFileAttachments,
  onCaptureScreenshot,
  onRemoveAttachment,
  onDetachAssistant,
  onAttachAssistant,
  onCollapseSidebar,
  onCitationClick,
  onSaveAssistantMessageAsNote,
}: ChatWorkspacePanelProps) {
  const l = useLocaleText();
  const locale = l('zh-CN', 'en-US') as 'zh-CN' | 'en-US';
  const panelRef = useRef<HTMLDivElement | null>(null);
  const historyRootRef = useRef<HTMLElement | null>(null);
  const chatRootRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const compactActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const handleHistoryWheelCapture = useWheelScrollDelegate({ rootRef: historyRootRef });
  const handleChatWheelCapture = useWheelScrollDelegate({ rootRef: chatRootRef });
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyPanelWidth, setHistoryPanelWidth] = useState(() =>
    loadStoredPanelWidth(CHAT_HISTORY_PANEL_WIDTH_STORAGE_KEY, 228),
  );
  const [resizingHistoryPanel, setResizingHistoryPanel] = useState(false);
  const [composerWidth, setComposerWidth] = useState(0);
  const [compactActionsOpen, setCompactActionsOpen] = useState(false);
  const activePreset =
    qaModelPresets.find((preset) => preset.id === selectedQaPresetId) ?? qaModelPresets[0] ?? null;
  const streamingAssistantMessage = loading && messages[messages.length - 1]?.role === 'assistant';
  const workspaceMode = layoutMode === 'workspace';
  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.updatedAt - left.updatedAt),
    [sessions],
  );
  const activeSession =
    orderedSessions.find((session) => session.id === selectedSessionId) ?? orderedSessions[0] ?? null;
  const handleCreateSessionClick = useCallback(() => {
    onSessionCreate();
    setHistoryCollapsed(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [onSessionCreate]);
  const suggestionPrompts = [
    l('Summarize the core contributions of this paper in three points.', 'Summarize the core contributions of this paper in three points.'),
    l('What advantages does this method have over the baseline models?', 'What advantages does this method have over the baseline models?'),
    l('Explain the experimental setup and the most important results.', 'Explain the experimental setup and the most important results.'),
  ];
  const canSubmit = input.trim().length > 0 && !loading;
  const composerActions = [
    {
      key: 'image',
      icon: ImagePlus,
      label: l('添加图片', 'Add images'),
      onClick: onSelectImageAttachments,
      disabled: false,
    },
    {
      key: 'file',
      icon: Paperclip,
      label: l('添加文件', 'Add files'),
      onClick: onSelectFileAttachments,
      disabled: false,
    },
    {
      key: 'screenshot',
      icon: Camera,
      label: screenshotLoading ? l('截图中...', 'Capturing...') : l('截图', 'Screenshot'),
      onClick: onCaptureScreenshot,
      disabled: screenshotLoading,
    },
    {
      key: 'quote',
      icon: Quote,
      label: l('引用选中内容', 'Quote selection'),
      onClick: onAppendSelectedExcerpt,
      disabled: !selectedExcerpt,
    },
  ] as const;
  const qaModeActions = [
    {
      key: 'rag',
      icon: Database,
      label: qaRagEnabled
        ? l('关闭本次问答 RAG', 'Turn off RAG for this chat')
        : l('开启本次问答 RAG', 'Turn on RAG for this chat'),
      onClick: () => onQaRagEnabledChange(!qaRagEnabled),
      active: qaRagEnabled,
    },
    {
      key: 'html',
      icon: Code2,
      label: qaAnswerRenderMode === 'html'
        ? l('关闭 HTML 预览回答', 'Turn off HTML preview replies')
        : l('开启 HTML 预览回答', 'Turn on HTML preview replies'),
      onClick: () => onQaAnswerRenderModeChange(qaAnswerRenderMode === 'html' ? 'markdown' : 'html'),
      active: qaAnswerRenderMode === 'html',
    },
  ] as const;
  const compactComposer = composerWidth > 0 && composerWidth <= CHAT_COMPOSER_COMPACT_WIDTH;
  const ultraCompactComposer =
    composerWidth > 0 && composerWidth <= CHAT_COMPOSER_ULTRA_COMPACT_WIDTH;
  const reasoningAction = {
    key: 'reasoning',
    icon: Bot,
    label: l('思考强度', 'Reasoning effort'),
    onClick: () => {
      const order: ModelReasoningEffort[] = ['auto', 'low', 'medium', 'high', 'xhigh'];
      const currentIndex = order.indexOf(qaReasoningEffort);
      onQaReasoningEffortChange(order[(currentIndex + 1) % order.length] ?? 'auto');
    },
    active: qaReasoningEffort !== 'auto',
  } as const;
  const primaryComposerActions = ultraCompactComposer
    ? []
    : compactComposer
    ? composerActions.filter((action) => action.key === 'image' || action.key === 'file')
    : composerActions;
  const secondaryComposerActions = ultraCompactComposer
    ? composerActions
    : compactComposer
    ? composerActions.filter((action) => action.key !== 'image' && action.key !== 'file')
    : [];

  useEffect(() => {
    const scrollElement = chatScrollRef.current;

    if (!scrollElement) {
      return;
    }

    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    const lastMessageChanged = previousLastMessageIdRef.current !== lastMessageId;

    previousLastMessageIdRef.current = lastMessageId;

    if (lastMessageChanged) {
      shouldStickToBottomRef.current = true;
    }

    if (!shouldStickToBottomRef.current && !isNearScrollBottom(scrollElement)) {
      return;
    }

    shouldStickToBottomRef.current = true;
    window.requestAnimationFrame(() => {
      const nextScrollElement = chatScrollRef.current;

      if (!nextScrollElement || (!shouldStickToBottomRef.current && !isNearScrollBottom(nextScrollElement))) {
        return;
      }

      nextScrollElement.scrollTop = nextScrollElement.scrollHeight;
    });
  }, [loading, messages]);

  useEffect(() => {
    const composerElement = composerRef.current;

    if (!composerElement) {
      return undefined;
    }

    setComposerWidth(Math.round(composerElement.getBoundingClientRect().width));

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0]?.contentRect.width ?? 0);
      setComposerWidth(nextWidth);
    });

    observer.observe(composerElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!compactComposer) {
      setCompactActionsOpen(false);
    }
  }, [compactComposer]);

  useEffect(() => {
    if (!compactActionsOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && compactActionsMenuRef.current?.contains(target)) {
        return;
      }

      setCompactActionsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [compactActionsOpen]);

  useEffect(() => {
    const textareaElement = textareaRef.current;

    if (!textareaElement) {
      return;
    }

    textareaElement.style.height = '0px';
    textareaElement.style.height = `${Math.min(
      textareaElement.scrollHeight,
      CHAT_COMPOSER_MAX_TEXTAREA_HEIGHT,
    )}px`;
  }, [composerWidth, input]);

  useEffect(() => {
    window.localStorage.setItem(
      CHAT_HISTORY_PANEL_WIDTH_STORAGE_KEY,
      String(Math.round(historyPanelWidth)),
    );
  }, [historyPanelWidth]);

  useEffect(() => {
    if (!resizingHistoryPanel) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const panelRect = panelRef.current?.getBoundingClientRect();

      if (!panelRect) {
        return;
      }

      const boundedMaxWidth = Math.min(
        MAX_CHAT_HISTORY_PANEL_WIDTH,
        Math.max(MIN_CHAT_HISTORY_PANEL_WIDTH, panelRect.width - MIN_CHAT_CONTENT_PANEL_WIDTH),
      );
      const nextWidth = Math.round(
        Math.min(
          boundedMaxWidth,
          Math.max(MIN_CHAT_HISTORY_PANEL_WIDTH, event.clientX - panelRect.left),
        ),
      );

      setHistoryPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setResizingHistoryPanel(false);
    };

    const previousUserSelect = globalThis.document.body.style.userSelect;
    const previousCursor = globalThis.document.body.style.cursor;

    globalThis.document.body.style.userSelect = 'none';
    globalThis.document.body.style.cursor = 'col-resize';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      globalThis.document.body.style.userSelect = previousUserSelect;
      globalThis.document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingHistoryPanel]);

  return (
    <div
      ref={panelRef}
      className={cn(
        'pq-saas-scope pq-chat-workspace paperquay-assistant flex h-full min-h-0 overflow-hidden bg-transparent',
        workspaceMode && 'min-h-[520px]',
      )}
    >
      {!historyCollapsed ? (
        <aside
          ref={historyRootRef}
          onWheelCapture={handleHistoryWheelCapture}
          className="pq-chat-pane flex min-h-0 shrink-0 flex-col border-r"
          style={{ width: historyPanelWidth }}
        >
          <div className="px-4 pb-2 pt-5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex min-w-0 items-center gap-1.5 rounded-lg text-left text-base font-semibold tracking-tight text-[var(--pq-text)]"
              >
                <span className="truncate">{l('最近', 'Recent')}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--pq-text-faint)]" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => setHistoryCollapsed(true)}
                title={l('收起历史记录', 'Collapse history')}
                aria-label={l('收起历史记录', 'Collapse history')}
                className="pq-icon-button h-7 w-7 shrink-0 border border-transparent bg-transparent text-[var(--pq-text-faint)]"
              >
                <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div
            data-wheel-scroll-target
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 pt-1"
          >
            {orderedSessions.length > 0 ? (
              <div className="space-y-0.5">
                {orderedSessions.map((session) => {
                  const active = session.id === selectedSessionId;

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'group flex items-center gap-1 rounded-xl px-2 py-1.5 transition',
                        active
                          ? 'bg-[var(--pq-surface-2)]'
                          : 'hover:bg-[var(--pq-hover)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSessionSelect(session.id)}
                        className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-[var(--pq-text)]">
                          {session.title || l('Untitled Chat', 'Untitled Chat')}
                        </div>
                      </button>
                      {active ? (
                        <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--pq-text-faint)]" strokeWidth={1.8} />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onSessionDelete(session.id)}
                        className="pq-icon-button h-7 w-7 shrink-0 rounded-lg border border-transparent bg-transparent text-[var(--pq-text-faint)] opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                        aria-label={l('删除会话', 'Delete chat')}
                        title={l('删除会话', 'Delete chat')}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--pq-border)] bg-white/58 px-4 py-5 text-sm leading-6 text-[var(--pq-text-muted)]">
                {l('No chat history yet. Create a new chat to get started.', 'No chat history yet. Create a new chat to get started.',
                )}
              </div>
            )}
          </div>
        </aside>
      ) : null}

      {!historyCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={l('调整历史侧栏宽度', 'Resize history sidebar')}
          onDoubleClick={() => setHistoryPanelWidth(228)}
          onPointerDown={(event) => {
            event.preventDefault();
            setResizingHistoryPanel(true);
          }}
          className="group relative z-10 w-2 shrink-0 cursor-col-resize bg-transparent transition-all duration-200"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300/80 transition-all duration-200 group-hover:w-[3px] group-hover:bg-slate-400" />
          <div className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 transition-all duration-200 group-hover:w-1.5 group-hover:bg-slate-500" />
        </div>
      ) : null}

      <div
        ref={chatRootRef}
        onWheelCapture={handleChatWheelCapture}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="pq-toolbar px-3 py-3 sm:px-4">
          <div
            className={cn(
              'grid min-h-10 items-center gap-2 sm:gap-3',
              workspaceMode
                ? 'grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto]'
                : 'grid-cols-[minmax(0,1fr)_auto]',
            )}
          >
            <div className={cn('min-w-0 pr-1', !workspaceMode && 'hidden')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                SESSION
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                {activeSession?.title || l('新会话', 'New Chat')}
              </div>
            </div>

            <ModelPresetPicker
              l={l}
              presets={qaModelPresets}
              selectedPresetId={selectedQaPresetId}
              onChange={onQaPresetChange}
              title={l('选择问答模型', 'Choose QA model')}
              className="min-w-0"
              pill
            />

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              {assistantDetached && onAttachAssistant ? (
                <button
                  type="button"
                  onClick={onAttachAssistant}
                  title={l('停靠回侧边栏', 'Dock back to sidebar')}
                  aria-label={l('停靠回侧边栏', 'Dock back to sidebar')}
                  className="pq-icon-button h-8 w-8 border border-[var(--pq-border)] bg-white/60"
                >
                  <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              ) : null}
              {!assistantDetached && onDetachAssistant ? (
                <button
                  type="button"
                  onClick={onDetachAssistant}
                  title={l('Open as floating window', 'Open as floating window')}
                  aria-label={l('Open as floating window', 'Open as floating window')}
                  className="pq-icon-button h-8 w-8 border border-[var(--pq-border)] bg-white/60"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              ) : null}
              {historyCollapsed ? (
                <button
                  type="button"
                  onClick={() => setHistoryCollapsed(false)}
                  title={l('历史记录', 'History')}
                  aria-label={l('历史记录', 'History')}
                  className="pq-icon-button h-8 w-8 border border-[var(--pq-border)] bg-white/60"
                >
                  <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleCreateSessionClick}
                title={l('新建会话', 'New Chat')}
                aria-label={l('新建会话', 'New Chat')}
                className="pq-icon-button h-8 w-8 shrink-0 border border-[var(--pq-border)] bg-slate-950 text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)] hover:bg-slate-800 dark:bg-white dark:text-slate-950"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
              </button>
              {onCollapseSidebar ? (
                <button
                  type="button"
                  onClick={onCollapseSidebar}
                  title={l('收起侧边栏', 'Collapse sidebar')}
                  aria-label={l('收起侧边栏', 'Collapse sidebar')}
                  className="pq-icon-button h-8 w-8 border border-[var(--pq-border)] bg-white/60"
                >
                  <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div
          ref={chatScrollRef}
          data-wheel-scroll-target
          onScroll={(event) => {
            shouldStickToBottomRef.current = isNearScrollBottom(event.currentTarget);
          }}
          onWheelCapture={(event) => {
            if (event.deltaY < 0) {
              shouldStickToBottomRef.current = false;
            }
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-transparent px-4 py-5"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center">
              <div className="pq-card w-full space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pq-accent)] text-white shadow-[0_12px_28px_var(--pq-accent-ring)]">
                    <MessageSquareText className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </span>
                  <div className="space-y-1.5">
                    <div className="text-base font-semibold text-slate-900">
                      {l('Start document chat', 'Start document chat')}
                    </div>
                    <div className="text-sm leading-6 text-slate-500">
                      {l('Ask directly, or attach selected text, images, files, or screenshots first.', 'Ask directly, or attach selected text, images, files, or screenshots first.',
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  {suggestionPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onInputChange(prompt)}
                      className="block w-full rounded-xl border border-[var(--pq-border)] bg-white/62 px-4 py-3 text-left text-sm text-[var(--pq-text-muted)] transition hover:border-[var(--pq-border-strong)] hover:bg-white hover:text-[var(--pq-text)]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((message) => {
                const assistantMessage = message.role === 'assistant';
                const rawMessageContent = (
                  assistantMessage ? cleanQaAssistantOutput(message.content) : message.content
                ).trim();
                const htmlAnswer = assistantMessage && message.renderMode === 'html';
                const renderHtmlPreview = htmlAnswer && shouldRenderHtmlAnswerPreview(rawMessageContent);
                const qaContextBadge = assistantMessage ? formatQaContextBadge(message.qaContext, l) : null;
                const qaContextHint = assistantMessage ? formatQaContextHint(message.qaContext, l) : null;
                const qaContextBadgeTone = assistantMessage
                  ? getQaContextBadgeTone(message.qaContext)
                  : 'neutral';
                const renderedMessageContent = assistantMessage && !renderHtmlPreview
                  ? injectCitationLinks(rawMessageContent, message.citations)
                  : rawMessageContent;

                return (
                  <div
                    key={message.id}
                    className={cn(
                       'flex gap-3',
                      assistantMessage ? 'items-start' : 'justify-end',
                      renderHtmlPreview && 'w-full',
                    )}
                  >
                    {assistantMessage ? (
                      <span className="hidden">
                        <Bot className="h-4 w-4" strokeWidth={1.9} />
                      </span>
                    ) : null}

                    <div
                      className={cn(
                        'min-w-0 px-4 py-3',
                        renderHtmlPreview ? 'flex-1 max-w-none px-3' : 'max-w-[90%]',
                        assistantMessage
                          ? 'pq-chat-bubble-assistant rounded-none text-[var(--pq-text)]'
                          : 'pq-chat-bubble-user rounded-2xl text-[var(--pq-text)]',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-2 flex items-center gap-2 text-[11px]',
                          'text-[var(--pq-text-faint)]',
                        )}
                      >
                        <span className="font-semibold">
                          {assistantMessage ? l('助手', 'Assistant') : l('You', 'You')}
                        </span>
                        {assistantMessage && message.modelLabel ? (
                          <span className="pq-chip px-2 py-0.5 text-[10px]">
                            {message.modelLabel}
                          </span>
                        ) : null}
                        {htmlAnswer ? (
                          <span className="rounded-full border border-[var(--pq-accent-border)] bg-[var(--pq-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--pq-accent)]">
                            HTML
                          </span>
                        ) : null}
                        {assistantMessage && qaContextBadge ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              qaContextBadgeTone === 'success' &&
                                'border border-emerald-200 bg-emerald-50 text-emerald-700',
                              qaContextBadgeTone === 'warning' &&
                                'border border-amber-200 bg-amber-50 text-amber-700',
                              qaContextBadgeTone === 'neutral' &&
                                'border border-slate-200 bg-slate-50 text-slate-500',
                            )}
                          >
                            {qaContextBadge}
                          </span>
                        ) : null}
                        <span>{formatChatSessionTime(message.createdAt, locale)}</span>
                        {assistantMessage && rawMessageContent ? (
                          <button
                            type="button"
                            onClick={() => onSaveAssistantMessageAsNote?.({
                              ...message,
                              content: rawMessageContent,
                            })}
                            disabled={!onSaveAssistantMessageAsNote}
                            className="ml-auto inline-flex h-6 items-center gap-1 rounded-lg border border-[var(--pq-border)] bg-white/64 px-2 text-[10px] font-medium text-[var(--pq-text-muted)] transition hover:border-[var(--pq-border-strong)] hover:bg-white hover:text-[var(--pq-text)] disabled:cursor-not-allowed disabled:opacity-50"
                            title={l('保存为笔记', 'Save as note')}
                          >
                            <FilePlus2 className="h-3 w-3" strokeWidth={1.8} />
                            {l('保存', 'Save')}
                          </button>
                        ) : null}
                      </div>

                      {renderHtmlPreview ? (
                        rawMessageContent ? (
                          <HtmlAnswerPreview content={rawMessageContent} />
                        ) : (
                          <div className="text-sm leading-7 text-slate-400">
                            {loading ? l('正在思考...', 'Thinking...') : ''}
                          </div>
                        )
                      ) : (
                        <MarkdownPreview
                        content={
                          renderedMessageContent ||
                          (assistantMessage && loading ? l('正在思考...', 'Thinking...') : '')
                        }
                        components={{
                          a: ({ href, children, ...props }) => {
                            const citation =
                              href && onCitationClick
                                ? findCitationByHref(href, message.citations)
                                : null;

                            if (citation && onCitationClick) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => onCitationClick(citation)}
                                  className="font-medium text-indigo-600 underline underline-offset-2 transition hover:text-indigo-800"
                                >
                                  [{children}]
                                </button>
                              );
                            }

                            if (href && message.citations && findCitationByHref(href, message.citations)) {
                              return <span className="text-slate-400">[{children}]</span>;
                            }

                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          },
                        }}
                          className={cn(
                            'text-sm leading-7',
                          assistantMessage && !rawMessageContent && loading && 'text-slate-400',
                          )}
                        />
                      )}

                      {assistantMessage && qaContextHint ? (
                        <div className="mt-3 rounded-xl border border-[var(--pq-border)] bg-white/56 px-3 py-2 text-xs leading-5 text-[var(--pq-text-muted)]">
                          {qaContextHint}
                        </div>
                      ) : null}

                      {assistantMessage &&
                      message.citations &&
                      message.citations.length > 0 &&
                      (renderHtmlPreview || !hasInlineCitationLinks(renderedMessageContent)) ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.citations.map((citation) => (
                            <button
                              key={citation.id}
                              type="button"
                              onClick={() => onCitationClick?.(citation)}
                              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
                              title={
                                citation.previewText
                                  ? `${
                                      citation.pageIndex !== null && citation.pageIndex !== undefined
                                        ? l(`Page ${citation.pageIndex + 1}`, `Page ${citation.pageIndex + 1}`)
                                        : citation.sourceType
                                    }\n${citation.previewText}`
                                  : undefined
                              }
                            >
                              <span>[{citation.label}]</span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => {
                            const AttachmentIcon =
                              attachment.kind === 'image'
                                ? ImagePlus
                                : attachment.kind === 'screenshot'
                                  ? Camera
                                  : Paperclip;

                            return (
                              <span
                                key={attachment.id}
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                                  assistantMessage
                                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                                    : 'border-white/10 bg-white/10 text-slate-100',
                                )}
                              >
                                <AttachmentIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                                <span className="max-w-[180px] truncate">{attachment.name}</span>
                                <span className={assistantMessage ? 'text-slate-400' : 'text-slate-300'}>
                                  {formatFileSize(attachment.size)}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {loading && !streamingAssistantMessage ? (
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--pq-accent)] text-white shadow-[0_10px_24px_var(--pq-accent-shadow)]">
                    <Bot className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div className="pq-chat-bubble-assistant max-w-[92%] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" strokeWidth={1.9} />
                      {l('模型回复中...', 'Model is replying...')}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {activePreset
                        ? l(`当前模型：${activePreset.label}`, `Current model: ${activePreset.label}`)
                        : l('Generating a response grounded in the current document.', 'Generating a response grounded in the current document.',
                          )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={messageEndRef} />
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--pq-border)] bg-white/62 px-4 py-4 backdrop-blur-xl dark:bg-white/5">
          {attachments.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((attachment) => {
                const AttachmentIcon =
                  attachment.kind === 'image'
                    ? ImagePlus
                    : attachment.kind === 'screenshot'
                      ? Camera
                      : Paperclip;

                return (
                  <div
                    key={attachment.id}
                    className="pq-card group inline-flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[var(--pq-text-muted)]"
                  >
                    {attachment.dataUrl &&
                    (attachment.kind === 'image' || attachment.kind === 'screenshot') ? (
                      <img
                        src={attachment.dataUrl}
                        alt={attachment.name}
                        className="h-10 w-10 rounded-xl border border-[var(--pq-border)] object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pq-accent-soft)] text-[var(--pq-accent)]">
                        <AttachmentIcon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="max-w-[180px] truncate font-medium text-slate-700">
                        {attachment.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {formatFileSize(attachment.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      className="pq-icon-button h-7 w-7 rounded-lg"
                      aria-label={l('移除附件', 'Remove attachment')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div
            ref={composerRef}
            className="pq-chat-composer pq-assistant-composer p-3"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (canSubmit) {
                    onSubmit();
                  }
                }
              }}
              placeholder={
                hasBlocks
                  ? l('Ask a question. Press Enter to send and Shift+Enter for a new line.', 'Ask a question. Press Enter to send and Shift+Enter for a new line.',
                    )
                  : l('Load document blocks before asking questions for more accurate answers.', 'Load document blocks before asking questions for more accurate answers.',
                    )
              }
              className="min-h-[80px] w-full resize-none overflow-y-auto rounded-2xl border-0 bg-transparent px-1 py-1 text-sm leading-7 text-[var(--pq-text)] outline-none placeholder:text-[var(--pq-text-faint)]"
            />

            <div className="mt-3 flex flex-nowrap items-end justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-visible pb-1">
                {primaryComposerActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      title={action.label}
                      aria-label={action.label}
                      className="pq-icon-button h-10 w-10 shrink-0 border border-[var(--pq-border)] bg-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {action.key === 'screenshot' && screenshotLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                      ) : (
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      )}
                    </button>
                  );
                })}

                {secondaryComposerActions.length > 0 ? (
                  <div ref={compactActionsMenuRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setCompactActionsOpen((open) => !open)}
                      title={l('更多操作', 'More actions')}
                      className="pq-icon-button h-10 w-10 border border-[var(--pq-border)] bg-white/60"
                      aria-label={l('更多操作', 'More actions')}
                      aria-expanded={compactActionsOpen}
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.8} />
                    </button>

                    {compactActionsOpen ? (
                      <div className="pq-card absolute bottom-full left-0 z-50 mb-2 min-w-[180px] p-2">
                        {[
                          ...secondaryComposerActions,
                          ...(compactComposer
                            ? [
                                ...qaModeActions,
                                ...(ultraCompactComposer ? [] : [reasoningAction]),
                              ]
                            : []),
                        ].map((action) => {
                          const Icon = action.icon;
                          const active = 'active' in action ? action.active : false;

                          return (
                            <button
                              key={action.key}
                              type="button"
                              onClick={() => {
                                setCompactActionsOpen(false);
                                action.onClick();
                              }}
                              disabled={'disabled' in action ? action.disabled : false}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                                active
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200'
                                  : 'text-[var(--pq-text-muted)] hover:bg-white/70 hover:text-[var(--pq-text)]',
                              )}
                            >
                              {'key' in action && action.key === 'screenshot' && screenshotLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                              ) : (
                                <Icon className="h-4 w-4" strokeWidth={1.8} />
                              )}
                              <span>{action.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!compactComposer ? (
                  qaModeActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={action.onClick}
                        title={action.label}
                        aria-label={action.label}
                        className={cn(
                          'pq-icon-button h-10 w-10 shrink-0 border transition-all',
                          action.active
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] dark:border-emerald-400/40 dark:bg-emerald-400/12 dark:text-emerald-200'
                            : 'border-[var(--pq-border)] bg-white/60',
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    );
                  })
                ) : null}

                {!compactComposer || ultraCompactComposer ? (
                  <ReasoningEffortPicker
                    l={l}
                    value={qaReasoningEffort}
                    onChange={onQaReasoningEffortChange}
                    title={l('问答思考强度', 'QA reasoning effort')}
                    compact={ultraCompactComposer}
                  />
                ) : null}
              </div>

              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                title={loading ? l('回复中', 'Replying') : l('发送', 'Send')}
                aria-label={loading ? l('回复中', 'Replying') : l('发送', 'Send')}
                className={cn(
                  'pq-button-primary shrink-0 text-sm disabled:cursor-not-allowed',
                  compactComposer ? 'h-10 w-10 rounded-full px-0' : 'h-11 px-4',
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.9} />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={1.9} />
                )}
                <span className={cn(compactComposer ? 'hidden' : 'hidden sm:inline')}>
                  {loading ? l('Replying', 'Replying') : l('Send', 'Send')}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[var(--pq-text-faint)]">
            <span>
              {hasBlocks
                ? l(
                    qaRagEnabled
                      ? 'Responses try local RAG first, then fall back to document content.'
                      : 'Responses use the document content directly.',
                    qaRagEnabled
                      ? 'Responses try local RAG first, then fall back to document content.'
                      : 'Responses use the document content directly.',
                  )
                : l('Load structured blocks first for better answers.', 'Load structured blocks first for better answers.')}
            </span>
            <span>
              {loading
                ? l('模型回复中...', 'Model is replying...')
                : l('Enter 发送 · Shift+Enter 换行', 'Enter to send · Shift+Enter for a new line')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatPanel(props: ChatWorkspacePanelProps) {
  const l = useLocaleText();

  return (
    <SectionCard
      title={l('文档问答', 'Document Chat')}
      description={l('Run multi-turn QA grounded in the current paper.', 'Run multi-turn QA grounded in the current paper.',
      )}
      icon={<MessageSquare className="h-4 w-4" strokeWidth={1.8} />}
      contentClassName="p-0"
    >
      <ChatWorkspacePanel {...props} />
    </SectionCard>
  );
}
