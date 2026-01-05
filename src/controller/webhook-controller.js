import { config } from "../config/config.js";
import { parseWebhookMessage } from "../utils/message-parser.js";
import { WebhookServiceInstance } from "../service/webhook-service.js";

export class WebhookController {
  static async verifyWebhook(req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  static async receiveWebhook(req, res) {
    // Meta exige responder rápido
    res.sendStatus(200);

    try {
      const incoming = parseWebhookMessage(req.body);
      if (!incoming) return;

      await WebhookServiceInstance.handleIncomingMessage(incoming);
    } catch (err) {
      console.error("Error procesando webhook:", err);
    }
  }
}
