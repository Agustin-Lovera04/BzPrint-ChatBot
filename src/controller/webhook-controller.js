import { config } from "../config/config.js";
import { IAServiceInstance } from "../service/Ia-service.js";

// Estado mínimo de conversaciones activas (en memoria)
const activeConversations = new Map();

// WhatsApp considera activa una conversación por 24 horas
const CONVERSATION_TTL = 24 * 60 * 60 * 1000;

export class WebhookController {

  static async verifyWebhook(req, res) {
    //Requisitos pedidos para verificar a webhook
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    //Si coinciden, quiere decir que Meta está verificando tu webhook y espera que le devuelvas el challenge
    if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
      console.log("Webhook verificado correctamente.");
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  //Aca llegan todos los mensajes
  static async receiveWebhook(req, res) {
    console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

    //Meta exige responder en menos de 10 segundos
    res.sendStatus(200);

    try {
      //Desarticulamos la estructura del webhook, para obtener los datos
      const entry = req.body.entry?.[0]?.changes?.[0];
      if (!entry) return;

      const value = entry.value;
      const message = value.messages?.[0];
      if (!message) return;

      const from = message.from;
      const text = message.text?.body;
      const now = Date.now();

      console.log("Mensaje de:", from);
      console.log("Tipo de mensaje:", message.type);

      // ==========================================
      // DETECCIÓN DE INICIO DE CONVERSACIÓN
      // ==========================================
      const conversation = activeConversations.get(from);
      const isNewConversation =
        !conversation || (now - conversation.lastMessageAt > CONVERSATION_TTL);

      if (isNewConversation) {
        activeConversations.set(from, { lastMessageAt: now });
        await WebhookController.sendStudentQuestion(from);
        return;
      }

      // Actualizamos timestamp de conversación activa
      conversation.lastMessageAt = now;

      // ==========================================
      // MENSAJES INTERACTIVOS (BOTONES / LISTAS)
      // ==========================================
      if (message.type === "interactive") {

        // Respuesta a botones
        if (message.interactive?.button_reply) {
          const buttonId = message.interactive.button_reply.id;
          console.log("Botón presionado:", buttonId);

          if (buttonId === "student_yes") {
            await WebhookController.sendStudentMaterialsList(from);
            return;
          }

          if (buttonId === "student_no") {
            await WebhookController.sendAutoReply(
              from,
              "Perfecto. Podés enviarme el archivo que necesitás imprimir."
            );
            return;
          }
        }

        // Respuesta a listas
        if (message.interactive?.list_reply) {
          const listId = message.interactive.list_reply.id;
          console.log("Elemento de lista seleccionado:", listId);

          await WebhookController.sendAutoReply(
            from,
            "Genial 👍 Ese material ya lo tengo. ¿Querés agregar otro archivo?"
          );
          return;
        }
      }

      // ==========================================
      // FALLBACK → IA
      // ==========================================
      if (text) {
        const aiReply = await IAServiceInstance.ask(text);
        await WebhookController.sendAutoReply(from, aiReply);
      }

    } catch (err) {
      console.error("Error procesando webhook:", err);
    }
  }

  // ==========================================
  // MENSAJE DE TEXTO SIMPLE
  // ==========================================
  static async sendAutoReply(to, message) {
    try {
      const metaFormattedNumber = WebhookController.convertToMetaFormat(to);

      await fetch(
        `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaFormattedNumber,
            type: "text",
            text: { body: message }
          })
        }
      );

    } catch (e) {
      console.error("Error enviando mensaje de texto:", e);
    }
  }

  // ==========================================
  // BOTONES: ¿SOS ESTUDIANTE?
  // ==========================================
  static async sendStudentQuestion(to) {
    try {
      const metaFormattedNumber = WebhookController.convertToMetaFormat(to);

      await fetch(
        `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaFormattedNumber,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: "Hola 👋 Soy el bot de Bz Print.\nPara ayudarte mejor:\n¿Sos estudiante?"
              },
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: "student_yes",
                      title: "Sí"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: "student_no",
                      title: "No"
                    }
                  }
                ]
              }
            }
          })
        }
      );

    } catch (e) {
      console.error("Error enviando botones de estudiante:", e);
    }
  }

  // ==========================================
  // LISTA DE MATERIALES PARA ESTUDIANTES
  // ==========================================
  static async sendStudentMaterialsList(to) {
    try {
      const metaFormattedNumber = WebhookController.convertToMetaFormat(to);

      await fetch(
        `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaFormattedNumber,
            type: "interactive",
            interactive: {
              type: "list",
              body: {
                text: "Estos son los materiales más pedidos por estudiantes. Elegí uno:"
              },
              footer: {
                text: "Bz Print"
              },
              action: {
                button: "Ver materiales",
                sections: [
                  {
                    title: "Libros y apuntes",
                    rows: [
                      {
                        id: "book_argenta",
                        title: "Argenta",
                        description: "Libro completo – 120 MB"
                      },
                      {
                        id: "book_latasher",
                        title: "Latasher",
                        description: "Tomo 1 – 95 MB"
                      },
                      {
                        id: "book_abogacia",
                        title: "Abogacia",
                        description: "PDF / Word"
                      }
                    ]
                  }
                ]
              }
            }
          })
        }
      );

    } catch (e) {
      console.error("Error enviando lista de materiales:", e);
    }
  }

  static convertToMetaFormat(whatsappNumber) {
    if (whatsappNumber.startsWith("549") && whatsappNumber.length === 13) {
      const countryCode = "54";
      const actualAreaCode = whatsappNumber.substring(3, 6);
      const number = whatsappNumber.substring(6);
      return countryCode + actualAreaCode + "15" + number;
    }
    return whatsappNumber;
  }
}