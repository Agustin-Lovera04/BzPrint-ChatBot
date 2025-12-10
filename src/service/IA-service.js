import { GroqDAO } from "../DAO/groq-dao.js";
class IAService {
  constructor(daoInstance) {
    this.dao = daoInstance;
  }

  async ask(prompt) {
    return await this.dao.ask(prompt);
  }
}

const groqDaoInstance = new GroqDAO();
export const IAServiceInstance = new IAService(groqDaoInstance);