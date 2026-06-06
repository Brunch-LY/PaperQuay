import type { PdfSource } from '../../types/reader';

export const LOCAL_PDF_PROTOCOL = 'paperquay-pdf';

export interface PdfJsDocumentInit {
  data?: Uint8Array;
  disableAutoFetch?: boolean;
  disableStream?: boolean;
  httpHeaders?: Record<string, string>;
  url?: string;
}

export function buildLocalPdfProtocolUrl(path: string): string {
  return `${LOCAL_PDF_PROTOCOL}://local/?path=${encodeURIComponent(path)}`;
}

export function buildPdfJsDocumentInit(
  source: PdfSource,
  pdfData: Uint8Array | null,
): PdfJsDocumentInit | null {
  if (source?.kind === 'local-path') {
    return {
      url: buildLocalPdfProtocolUrl(source.path),
    };
  }

  if (source?.kind === 'remote-url') {
    return source.headers
      ? {
          url: source.url,
          httpHeaders: source.headers,
        }
      : {
          url: source.url,
        };
  }

  if (pdfData) {
    return {
      data: pdfData,
    };
  }

  return null;
}

export function getPdfSourceSignature(source: PdfSource, fallback = ''): string {
  if (source?.kind === 'local-path') {
    return `local:${source.path}`;
  }

  if (source?.kind === 'remote-url') {
    return `remote:${source.url}`;
  }

  return fallback;
}
