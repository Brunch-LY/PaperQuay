import type {
  LiteratureAttachment,
  LiteraturePaper,
} from '../types/library';

export interface ResolvedPaperPdfAttachment {
  attachment: LiteratureAttachment;
  path: string;
}

function cleanPath(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function resolveAttachmentPdfPath(attachment: LiteratureAttachment): string {
  return cleanPath(attachment.storedPath) || cleanPath(attachment.originalPath);
}

export function resolvePaperPdfAttachment(
  paper: LiteraturePaper,
): ResolvedPaperPdfAttachment | null {
  const pdfAttachments = paper.attachments.filter((attachment) => attachment.kind === 'pdf');

  for (const attachment of pdfAttachments) {
    if (attachment.missing) {
      continue;
    }

    const path = resolveAttachmentPdfPath(attachment);

    if (path) {
      return { attachment, path };
    }
  }

  for (const attachment of pdfAttachments) {
    const path = resolveAttachmentPdfPath(attachment);

    if (path) {
      return { attachment, path };
    }
  }

  return null;
}

export function paperPdfPath(paper: LiteraturePaper): string | null {
  return resolvePaperPdfAttachment(paper)?.path ?? null;
}
