import { config } from "../config/config.js";

export class WhatsAppDAO {
  convertToMetaFormat(whatsappNumber) {
    // MISMA lógica que venías usando
    if (whatsappNumber.startsWith("549") && whatsappNumber.length === 13) {
      const countryCode = "54";
      const actualAreaCode = whatsappNumber.substring(3, 6);
      const number = whatsappNumber.substring(6);
      return countryCode + actualAreaCode + "15" + number;
    }
    return whatsappNumber;
  }

  async sendText(to, message) {
    try {
      const metaFormattedNumber = this.convertToMetaFormat(to);

      await fetch(
        `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaFormattedNumber,
            type: "text",
            text: { body: message },
          }),
        }
      );
    } catch (e) {
      console.error("Error enviando mensaje de texto:", e);
    }
  }

  async sendPayload(to, payload) {
    try {
      const metaFormattedNumber = this.convertToMetaFormat(to);

      await fetch(
        `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaFormattedNumber,
            ...payload,
          }),
        }
      );
    } catch (e) {
      console.error("Error enviando payload:", e);
    }
  }
}
