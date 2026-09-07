
import type { ChatMessage, ReplyQuote } from '../../services/serviceGroup';

export function quoteOf(message: ChatMessage): ReplyQuote {
  const deleted = message.deletedAt !== null;
  return {
    id: message.id,
    senderName: message.senderName,
    content: deleted ? '' : message.content,
    deleted,
  };
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
