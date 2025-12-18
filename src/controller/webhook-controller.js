import { config } from "../config/config.js";
import { IAServiceInstance } from "../service/Ia-service.js";
import { listaDeArchivos } from "../data/catalogo.js";
import {
  buildStudentMaterialsList,
  buildButtonQuestion,
} from "../utils/whatsapp-builders.js";

// ==========================================
// ESTADO DE CONVERSACIONES (EN MEMORIA)
// ==========================================
const activeConversations = new Map();
const CONVERSATION_TTL = 24 * 60 * 60 * 1000;

// Estados posibles del flujo
const STATES = {
  WAIT_STUDENT_ANSWER: "WAIT_STUDENT_ANSWER",
  WAIT_MATERIAL: "WAIT_MATERIAL",
  WAIT_MORE_FILES: "WAIT_MORE_FILES",
  WAIT_FILES: "WAIT_FILES",
  WAIT_FILES_CONFIRM: "WAIT_FILES_CONFIRM",
  PRINT_OPTIONS: "PRINT_OPTIONS",
};

export class WebhookController {
  // ==========================================
  // VERIFICACIÓN DE WEBHOOK
  // ==========================================
  static async verifyWebhook(req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  // ==========================================
  // RECEPCIÓN DE MENSAJES
  // ==========================================
  static async receiveWebhook(req, res) {
    // Meta exige responder rápido
    res.sendStatus(200);

    try {
      const entry = req.body.entry?.[0]?.changes?.[0];
      if (!entry) return;

      const value = entry.value;
      const message = value.messages?.[0];
      if (!message) return;

      const from = message.from;
      const text = message.text?.body;
      const now = Date.now();

      // ==========================================
      // INICIO / TTL DE CONVERSACIÓN
      // ==========================================
      const conversation = activeConversations.get(from);
      const isNewConversation =
        !conversation || now - conversation.lastMessageAt > CONVERSATION_TTL;

      if (isNewConversation) {
        activeConversations.set(from, {
          lastMessageAt: now,
          state: STATES.WAIT_STUDENT_ANSWER,
        });

        await WebhookController.sendStudentQuestion(from);
        return;
      }

      conversation.lastMessageAt = now;
      const { state } = conversation;

      console.log("Estado actual:", state);
      console.log("Tipo de mensaje:", message.type);

      // ==========================================
      // MENSAJES INTERACTIVOS
      // ==========================================
      if (message.type === "interactive") {
        // ---------- BOTONES ----------
        if (message.interactive?.button_reply) {
          const buttonId = message.interactive.button_reply.id;
          console.log("Botón presionado:", buttonId);

          // RESPUESTA A ¿SOS ESTUDIANTE?
          if (state === STATES.WAIT_STUDENT_ANSWER) {
            if (buttonId === "student_yes") {
              conversation.state = STATES.WAIT_MATERIAL;
              await WebhookController.sendStudentMaterialsList(from);
              return;
            }

            if (buttonId === "student_no") {
              conversation.state = STATES.WAIT_FILES;
              await WebhookController.sendAutoReply(
                from,
                "Perfecto. Podés enviarme el archivo que necesitás imprimir."
              );
              return;
            }
          }

          // RESPUESTA A ¿AGREGAR MÁS ARCHIVOS?
          if (state === STATES.WAIT_MORE_FILES) {
            if (buttonId === "add_files") {
              conversation.state = STATES.WAIT_MATERIAL;
              await WebhookController.sendStudentMaterialsList(from);
              return;
            }

            if (buttonId === "finally_files") {
              conversation.state = STATES.PRINT_OPTIONS;
              await WebhookController.sendAutoReply(
                from,
                "Perfecto. Continuamos con las opciones de impresión."
              );
              return;
            }
          }
        }

        //RESPUESTA A FINALIZACION DE ENVIO DE ARHCIVOS?
        if (
          message.interactive?.button_reply &&
          message.interactive.button_reply.id === "files_done" &&
          conversation.state === STATES.WAIT_FILES
        ) {
          const filesCount = conversation.files?.length ?? 0;
          conversation.state = STATES.PRINT_OPTIONS;

          await WebhookController.sendAutoReply(
            from,
            `Perfecto 👍 Recibí *${filesCount}* archivo(s).\nAhora vamos con las opciones de impresión.`
          );

          // siguiente paso del flujo
          return;
        }

        // ---------- LISTAS ----------
        if (message.interactive?.list_reply && state === STATES.WAIT_MATERIAL) {
          const listId = message.interactive.list_reply.id;
          console.log("Elemento seleccionado:", listId);

          const selectedMaterial = listaDeArchivos.find(
            (mat) => mat.id === listId
          );

          if (!selectedMaterial) {
            await WebhookController.sendAutoReply(
              from,
              "No pude identificar el material seleccionado."
            );
            return;
          }

          conversation.state = STATES.WAIT_MORE_FILES;
          if (listId === "otros") {
            conversation.state = STATES.WAIT_FILES;

            await WebhookController.sendAutoReply(
              from,
              "Perfecto 👍\nEnviá todos los archivos que quieras imprimir.\nCuando termines, tocá el botón *Terminé de enviar archivos*."
            );

            await WebhookController.sendFinishFilesButton(from);
            return;
          }
          await WebhookController.sendAutoReply(
            from,
            `Perfecto. Seleccionaste *${selectedMaterial.title}*.`
          );

          await WebhookController.sendAddMoreFilesQuestion(from);
          return;
        }
      }

      // ==========================================
      // RECEPCIÓN DE ARCHIVOS (DOCUMENTOS E IMÁGENES)
      // ==========================================
      if (
        (message.type === "document" || message.type === "image") &&
        conversation.state === STATES.WAIT_FILES
      ) {
        conversation.files ??= [];

        if (message.type === "document") {
          const { filename, id: mediaId } = message.document;

          conversation.files.push({
            mediaId,
            filename,
            type: "document",
          });

          await WebhookController.sendAutoReply(
            from,
            `📄 Recibido: *${filename}*`
          );
        }

        if (message.type === "image") {
          const { id: mediaId } = message.image;

          conversation.files.push({
            mediaId,
            filename: "imagen.jpg",
            type: "image",
          });

          await WebhookController.sendAutoReply(from, `🖼️ Imagen recibida`);
        }

        return;
      }
      // ==========================================
      // FALLBACK → IA (SOLO SI NO ROMPE EL FLUJO)
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
  // ENVÍO DE TEXTO SIMPLE
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

  // ==========================================
  // ENVÍO GENÉRICO DE BOTONES
  // ==========================================
  static async sendButtonQuestion(to, questionConfig) {
    try {
      const metaFormattedNumber = WebhookController.convertToMetaFormat(to);
      const payload = buildButtonQuestion(questionConfig);

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
      console.error("Error enviando botones:", e);
    }
  }

  // ==========================================
  // PREGUNTAS CONCRETAS (REUTILIZAN BUILDER)
  // ==========================================
  static async sendStudentQuestion(to) {
    return WebhookController.sendButtonQuestion(to, {
      text: "Hola 👋 Soy el bot de Bz Print.\nPara ayudarte mejor:\n¿Sos estudiante?",
      buttons: [
        { id: "student_yes", title: "Sí" },
        { id: "student_no", title: "No" },
      ],
    });
  }

  static async sendAddMoreFilesQuestion(to) {
    return WebhookController.sendButtonQuestion(to, {
      text: "Antes de seguir con las opciones de impresión,\n¿querés agregar más archivos a tu pedido?",
      buttons: [
        { id: "add_files", title: "Sí" },
        { id: "finally_files", title: "No" },
      ],
    });
  }

  // ==========================================
  // LISTA DE MATERIALES
  // ==========================================
  static async sendStudentMaterialsList(to) {
    try {
      const metaFormattedNumber = WebhookController.convertToMetaFormat(to);
      const payload = buildStudentMaterialsList(listaDeArchivos);

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
      console.error("Error enviando lista de materiales:", e);
    }
  }

  static async sendFinishFilesButton(to) {
    return WebhookController.sendButtonQuestion(to, {
      text: "¿Ya terminaste de enviar los archivos?",
      buttons: [{ id: "files_done", title: "Sí, terminé" }],
    });
  }

  // ==========================================
  // FORMATO DE NÚMERO PARA META
  // ==========================================
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
