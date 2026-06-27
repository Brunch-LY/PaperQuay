import type { LibraryAgentPaperScopeInput } from '../../services/libraryAgent';
import type { AgentChatMessage, AgentHistorySession } from './AgentWorkspace.types';

export function containsLegacyMojibake(value: string): boolean {
  return /[\uFFFD]|\u93b6|\u95ab|\u7b49|\u93c0|\u7025/.test(value);
}

export function hasSameAgentHistoryMessages(
  left: AgentHistorySession | undefined,
  right: AgentHistorySession,
): boolean {
  return Boolean(left) && JSON.stringify(left?.messages) === JSON.stringify(right.messages);
}

export function uniquePaperScopeIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
}

function excerptAgentMessage(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function buildConversationPaperScopes(
  messages: AgentChatMessage[],
  currentPaperScopeIds: string[],
): LibraryAgentPaperScopeInput[] {
  const scopes: LibraryAgentPaperScopeInput[] = [];
  const seenKeys = new Set<string>();
  const currentIds = uniquePaperScopeIds(currentPaperScopeIds);

  if (currentIds.length > 0) {
    const key = currentIds.join('|');
    seenKeys.add(key);
    scopes.push({
      id: 'current-turn',
      label: 'Current turn paper scope',
      source: 'current',
      paperIds: currentIds,
    });
  }

  const scopedMessages = messages
    .filter((message) => message.paperScopeIds?.length)
    .slice(-16)
    .reverse();

  for (const message of scopedMessages) {
    const paperIds = uniquePaperScopeIds(message.paperScopeIds ?? []);

    if (paperIds.length === 0) {
      continue;
    }

    const key = paperIds.join('|');

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    scopes.push({
      id: `history-${message.id}`,
      label: `${message.role === 'user' ? 'User' : 'Assistant'} turn paper scope`,
      source: 'history',
      paperIds,
      messageRole: message.role,
      messageContent: excerptAgentMessage(message.content),
    });

    if (scopes.length >= 9) {
      break;
    }
  }

  return scopes;
}

export function collectPaperScopeCandidateIds(scopes: LibraryAgentPaperScopeInput[]): string[] {
  return uniquePaperScopeIds(scopes.flatMap((scope) => scope.paperIds));
}

export function latestConversationPaperScopeIds(messages: AgentChatMessage[]): string[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const ids = uniquePaperScopeIds(messages[index]?.paperScopeIds ?? []);

    if (ids.length > 0) {
      return ids;
    }
  }

  return [];
}
