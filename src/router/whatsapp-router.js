import { Router } from 'express';
import { WebhookController } from '../controller/webhook-controller.js';

export const router = Router();

router.get("/", WebhookController.verifyWebhook);
router.post("/", WebhookController.receiveWebhook);
