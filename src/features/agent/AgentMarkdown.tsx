import { Component, type ReactNode, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeMarkdownMath } from '../../utils/markdown';

class AgentMarkdownBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    resetKey: string;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function AgentMarkdownFallback({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-[var(--pq-radius-md)] border border-[var(--pq-border)] bg-[var(--pq-surface-2)] px-4 py-3 text-sm leading-7 text-[var(--pq-text-muted)]">
      {content}
    </pre>
  );
}

function protectBarePaperIds(content: string): string {
  const fenceParts = content.split(/(```[\s\S]*?```)/g);

  return fenceParts
    .map((part) => {
      if (part.startsWith('```')) {
        return part;
      }

      return part
        .split(/(`[^`\n]+`)/g)
        .map((inlinePart) => {
          if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
            return inlinePart;
          }

          return inlinePart.replace(
            /(^|[^\w`])((?:paper|category)_[A-Za-z0-9_-]{8,})(?=$|[^\w`])/g,
            (_match, prefix: string, id: string) => `${prefix}\`${id}\``,
          );
        })
        .join('');
    })
    .join('');
}

export default function AgentMarkdown({ content }: { content: string }) {
  const normalizedContent = useMemo(() => {
    try {
      return protectBarePaperIds(normalizeMarkdownMath(content));
    } catch {
      return protectBarePaperIds(content);
    }
  }, [content]);
  const fallback = <AgentMarkdownFallback content={content} />;

  return (
    <AgentMarkdownBoundary resetKey={normalizedContent} fallback={fallback}>
      <ReactMarkdown
        className={[
          'max-w-none text-sm leading-7 text-[var(--pq-text-muted)]',
          '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          '[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:border-b [&_h1]:border-[var(--pq-border)] [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[var(--pq-text)]',
          '[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--pq-text)]',
          '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--pq-text)]',
          '[&_p]:my-2 [&_p]:leading-7 [&_strong]:font-semibold [&_strong]:text-[var(--pq-text)] [&_em]:text-[var(--pq-text-muted)]',
          '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:pl-1',
          '[&_blockquote]:my-4 [&_blockquote]:rounded-[var(--pq-radius-md)] [&_blockquote]:border [&_blockquote]:border-[var(--pq-border)] [&_blockquote]:bg-[var(--pq-surface-2)] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-[var(--pq-text-muted)]',
          '[&_hr]:my-5 [&_hr]:border-[var(--pq-border)]',
          '[&_code]:rounded-md [&_code]:bg-[var(--pq-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-[var(--pq-accent)]',
          '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--pq-radius-md)] [&_pre]:border [&_pre]:border-[var(--pq-border)] [&_pre]:bg-[#111827] [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100',
          '[&_a]:font-semibold [&_a]:text-[var(--pq-accent)] [&_a]:underline [&_a]:underline-offset-4',
          '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-[var(--pq-radius-md)] [&_th]:border [&_th]:border-[var(--pq-border)] [&_th]:bg-[var(--pq-surface-2)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-[var(--pq-border)] [&_td]:px-3 [&_td]:py-2',
          '[&_.katex]:text-[var(--pq-text)] [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2',
        ].join(' ')}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: 'ignore', throwOnError: true }]]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </AgentMarkdownBoundary>
  );
}
