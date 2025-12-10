import { config } from "../config/config.js";

export class GroqDAO {
  async ask(prompt) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      const data = await response.json();

      const choice = data?.choices?.[0]?.message;
      const reasoning = choice?.reasoning_content;
      const content = choice?.content;

      return reasoning || content || "No pude generar una respuesta.";

    } catch (error) {
      return "Error generando respuesta con IA.";
    }
  }
}
