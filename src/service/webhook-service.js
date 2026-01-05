import { WebhookFlowService } from "./webhook-flow-service.js";
import { ConversationDAO } from "../DAO/conversation-dao.js";
import { WhatsAppDAO } from "../DAO/whatsapp-dao.js";

class WebhookService {
  constructor(flowInstance) {
    this.flow = flowInstance;
  }

  async handleIncomingMessage(incoming) {
    return await this.flow.handleIncomingMessage(incoming);
  }
}

const conversationDaoInstance = new ConversationDAO();
const whatsappDaoInstance = new WhatsAppDAO();
const flowInstance = new WebhookFlowService(conversationDaoInstance, whatsappDaoInstance);

export const WebhookServiceInstance = new WebhookService(flowInstance);
