import { IAServiceInstance } from "./Ia-service.js";
import { listaDeArchivos } from "../data/catalogo.js";
import { buildButtonQuestion, buildStudentMaterialsList } from "../utils/whatsapp-builders.js";
import { STATES } from "../DAO/conversation-dao.js";

export class WebhookFlowService {
  constructor(conversationDAO, whatsappDAO) {
    this.conversationDAO = conversationDAO;
    this.whatsappDAO = whatsappDAO;
  }

  async handleIncomingMessage(incoming) {
    const { from, type, text, buttonId, listId, document, image } = incoming;

    const { conversation, isNewConversation } = this.conversationDAO.getOrCreate(from);

    if (isNewConversation) {
      await this.sendStudentQuestion(from);
      return;
    }

    const state = conversation.state;

    console.log("Estado actual:", state);
    console.log("Tipo de mensaje:", type);

    // =========================
    // INTERACTIVOS
    // =========================
    if (type === "interactive") {
      // BOTONES
      if (buttonId) {
        console.log("Botón presionado:", buttonId);

        // ¿Sos estudiante?
        if (state === STATES.WAIT_STUDENT_ANSWER) {
          if (buttonId === "student_yes") {
            conversation.state = STATES.WAIT_MATERIAL;
            await this.sendStudentMaterialsList(from);
            return;
          }

          if (buttonId === "student_no") {
            conversation.state = STATES.WAIT_FILES;
            await this.whatsappDAO.sendText(
              from,
              "Perfecto. Podés enviarme el archivo que necesitás imprimir."
            );
            await this.sendFinishFilesButton(from);
            return;
          }
        }

        // ¿Agregar más archivos?
        if (state === STATES.WAIT_MORE_FILES) {
          if (buttonId === "add_files") {
            conversation.state = STATES.WAIT_MATERIAL;
            await this.sendStudentMaterialsList(from);
            return;
          }

          if (buttonId === "finally_files") {
            conversation.state = STATES.PRINT_OPTIONS;
            await this.whatsappDAO.sendText(
              from,
              "Perfecto. Continuamos con las opciones de impresión."
            );
            return;
          }
        }

        // Terminé de enviar archivos
        if (buttonId === "files_done" && conversation.state === STATES.WAIT_FILES) {
          const filesCount = conversation.files?.length ?? 0;
          conversation.state = STATES.PRINT_OPTIONS;

          await this.whatsappDAO.sendText(
            from,
            `Perfecto 👍 Recibí *${filesCount}* archivo(s).\nAhora vamos con las opciones de impresión.`
          );
          return;
        }
      }

      // LISTAS
      if (listId && state === STATES.WAIT_MATERIAL) {
        console.log("Elemento seleccionado:", listId);

        const selectedMaterial = listaDeArchivos.find((mat) => mat.id === listId);

        if (!selectedMaterial) {
          await this.whatsappDAO.sendText(from, "No pude identificar el material seleccionado.");
          return;
        }

        conversation.state = STATES.WAIT_MORE_FILES;

        if (listId === "otros") {
          conversation.state = STATES.WAIT_FILES;

          await this.whatsappDAO.sendText(
            from,
            "Perfecto 👍\nEnviá todos los archivos que quieras imprimir.\nCuando termines, tocá el botón *Terminé de enviar archivos*."
          );

          await this.sendFinishFilesButton(from);
          return;
        }

        await this.whatsappDAO.sendText(
          from,
          `Perfecto. Seleccionaste *${selectedMaterial.title}*.`
        );

        await this.sendAddMoreFilesQuestion(from);
        return;
      }
    }

    // =========================
    // ARCHIVOS cuando WAIT_FILES
    // =========================
    if ((type === "document" || type === "image") && conversation.state === STATES.WAIT_FILES) {
      conversation.files ??= [];

      if (type === "document" && document) {
        conversation.files.push({
          mediaId: document.mediaId,
          filename: document.filename,
          type: "document",
        });

        await this.whatsappDAO.sendText(from, `📄 Recibido: *${document.filename}*`);
        return;
      }

      if (type === "image" && image) {
        conversation.files.push({
          mediaId: image.mediaId,
          filename: image.filename,
          type: "image",
        });

        await this.whatsappDAO.sendText(from, `🖼️ Imagen recibida`);
        return;
      }

      return;
    }

    // =========================
    // FALLBACK IA
    // =========================
    if (text) {
      const aiReply = await IAServiceInstance.ask(text);
      await this.whatsappDAO.sendText(from, aiReply);
    }
  }

  // ========== Helpers de envío (usan builders + WhatsAppDAO) ==========

  async sendStudentQuestion(to) {
    const payload = buildButtonQuestion({
      text: "Hola 👋 Soy el bot de Bz Print.\nPara ayudarte mejor:\n¿Sos estudiante?",
      buttons: [
        { id: "student_yes", title: "Sí" },
        { id: "student_no", title: "No" },
      ],
    });

    return this.whatsappDAO.sendPayload(to, payload);
  }

  async sendAddMoreFilesQuestion(to) {
    const payload = buildButtonQuestion({
      text: "Antes de seguir con las opciones de impresión,\n¿querés agregar más archivos a tu pedido?",
      buttons: [
        { id: "add_files", title: "Sí" },
        { id: "finally_files", title: "No" },
      ],
    });

    return this.whatsappDAO.sendPayload(to, payload);
  }

  async sendFinishFilesButton(to) {
    const payload = buildButtonQuestion({
      text: "¿Ya terminaste de enviar los archivos?",
      buttons: [{ id: "files_done", title: "Sí, terminé" }],
    });

    return this.whatsappDAO.sendPayload(to, payload);
  }

  async sendStudentMaterialsList(to) {
    const payload = buildStudentMaterialsList(listaDeArchivos);
    return this.whatsappDAO.sendPayload(to, payload);
  }
}
