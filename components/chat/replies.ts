
import type { ChatMessage, ReplyQuote } from '../../services/serviceChat';
import { isBlocked } from '../../services/serviceSafety';

export function quoteOf(message: ChatMessage): ReplyQuote {
  const deleted = message.deletedAt !== null;
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    content: deleted ? '' : message.content,
    deleted,
    hidden: isBlocked(message.senderId),
  };
}

// After a block or unblock: their messages leave, and quotes of them hide.
// Returns the same array when nothing changed.
export function applyBlocks(messages: ChatMessage[]): ChatMessage[] {
  let touched = false;
  const next: ChatMessage[] = [];
  for (const entry of messages) {
    if (isBlocked(entry.senderId)) {
      touched = true;
      continue;
    }
    const hidden = entry.reply ? isBlocked(entry.reply.senderId) : false;
    if (entry.reply && entry.reply.hidden !== hidden) {
      touched = true;
      next.push({ ...entry, reply: { ...entry.reply, hidden } });
    } else {
      next.push(entry);
    }
  }
  return touched ? next : messages;
}

export function resolveQuote(message: ChatMessage, known: ChatMessage[]): ChatMessage {
  if (message.replyTo === null || message.reply !== null) {
    return message;
  }

  const original = known.find((entry) => entry.id === message.replyTo);
  if (!original) {
    return message;
  }

  return { ...message, reply: quoteOf(original) };
}

export function refreshQuotes(messages: ChatMessage[], changed: ChatMessage): ChatMessage[] {
  const quote = quoteOf(changed);

  let touched = false;
  const next = messages.map(function (entry) {
    if (entry.replyTo !== changed.id) {
      return entry;
    }
    if (
      entry.reply &&
      entry.reply.content === quote.content &&
      entry.reply.deleted === quote.deleted &&
      entry.reply.hidden === quote.hidden &&
      entry.reply.senderName === quote.senderName
    ) {
      return entry;
    }
    touched = true;
    return { ...entry, reply: quote };
  });

  return touched ? next : messages;
}

export function resolveQuotes(messages: ChatMessage[]): ChatMessage[] {
  let touched = false;
  const next = messages.map(function (entry) {
    const filled = resolveQuote(entry, messages);
    if (filled !== entry) touched = true;
    return filled;
  });
  return touched ? next : messages;
}
