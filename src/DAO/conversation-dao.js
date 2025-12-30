const CONVERSATION_TTL = 24 * 60 * 60 * 1000;

const STATES = {
  WAIT_STUDENT_ANSWER: "WAIT_STUDENT_ANSWER",
  WAIT_MATERIAL: "WAIT_MATERIAL",
  WAIT_MORE_FILES: "WAIT_MORE_FILES",
  WAIT_FILES: "WAIT_FILES",
  WAIT_FILES_CONFIRM: "WAIT_FILES_CONFIRM",
  PRINT_OPTIONS: "PRINT_OPTIONS",
};

class ConversationDAO {
  constructor() {
    this.activeConversations = new Map();
  }

  getOrCreate(from) {
    const now = Date.now();
    const conversation = this.activeConversations.get(from);

    const isNewConversation =
      !conversation || now - conversation.lastMessageAt > CONVERSATION_TTL;

    if (isNewConversation) {
      const fresh = { lastMessageAt: now, state: STATES.WAIT_STUDENT_ANSWER };
      this.activeConversations.set(from, fresh);
      return { conversation: fresh, isNewConversation: true, STATES };
    }

    conversation.lastMessageAt = now;
    return { conversation, isNewConversation: false, STATES };
  }
}

export const conversationDAOInstance = new ConversationDAO();
export { STATES };
