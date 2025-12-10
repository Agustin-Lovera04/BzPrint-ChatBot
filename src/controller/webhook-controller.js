import { config } from "../config/config.js";
import { IAServiceInstance } from "../service/Ia-service.js";

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

    //Esto se hace por: Meta exige que responda en menos de 10 segundos.
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

      console.log("Mensaje de:", from);
      console.log("Texto:", text);


      /* //Construimos coincidencia para responder solamente rapido
      if (text?.toLowerCase() === "hola") {
        WebhookController.sendAutoReply(from);
      }

    } catch (err) {
      console.error("Error procesando webhook:", err);
    }
  } */
    if (text) {
            const aiReply = await IAServiceInstance.ask(text)
            await WebhookController.sendAutoReply(from, aiReply);
          }

        } catch (err) {
          console.error("Error procesando webhook:", err);
        }
      }


  static async sendAutoReply(to, message) {
  try {
    console.log("=== DEBUG INICIO ===");
    console.log("Número CRUDO del webhook:", to);
    
    //Formateamos el numero para que llegue correctamente a META
    const metaFormattedNumber = WebhookController.convertToMetaFormat(to);
    
    console.log("Número para Meta:", metaFormattedNumber);
    console.log("Usando Phone ID:", config.WHATSAPP_PHONE_ID);
    console.log('to', to)
    
    //Fetch con estructura correcta para envio de mensajes
    const response = await fetch(
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

    const data = await response.json();
    console.log("Resultado de Meta:", data);

  } catch (e) {
    console.error("Error enviando respuesta automática:", e);
  }
}

static convertToMetaFormat(whatsappNumber) {

  if (whatsappNumber.startsWith('549') && whatsappNumber.length === 13) {
    
    const countryCode = '54';
    const areaCode = whatsappNumber.substring(2, 5); 
    
    
    const actualAreaCode = whatsappNumber.substring(3, 6); 
    const number = whatsappNumber.substring(6); 

    const metaFormat = countryCode + actualAreaCode + '15' + number;
    console.log(`Conversión: ${whatsappNumber} -> ${metaFormat}`);
    
    return metaFormat; 
  }
  
  return whatsappNumber;
}
}