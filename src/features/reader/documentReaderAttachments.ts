import type { DocumentChatAttachment } from '../../types/reader';

export function getChatAttachmentKey(
  attachment: Pick<DocumentChatAttachment, 'filePath' | 'name' | 'size'>,
): string {
  return `${attachment.filePath || attachment.name}:${attachment.size}`;
}

export function appendUniqueChatAttachments(
  current: DocumentChatAttachment[],
  nextAttachments: DocumentChatAttachment[],
): DocumentChatAttachment[] {
  if (nextAttachments.length === 0) {
    return current;
  }

  const existingKeys = new Set(current.map(getChatAttachmentKey));
  const uniqueAttachments = nextAttachments.filter((attachment) => {
    const attachmentKey = getChatAttachmentKey(attachment);

    if (existingKeys.has(attachmentKey)) {
      return false;
    }

    existingKeys.add(attachmentKey);
    return true;
  });

  return uniqueAttachments.length > 0 ? [...current, ...uniqueAttachments] : current;
}
