const activeConversations = new Map();
const CONVERSATION_TTL = 24 * 60 * 60 * 1000;

export function getConversation(from) {
  const now = Date.now();
  const conversation = activeConversations.get(from);

  if (!conversation || now - conversation.lastMessageAt > CONVERSATION_TTL) {
    const newConv = {
      state: null,
      lastMessageAt: now,
      files: [],
    };
    activeConversations.set(from, newConv);
    return { conversation: newConv, isNew: true };
  }

  conversation.lastMessageAt = now;
  return { conversation, isNew: false };
}
