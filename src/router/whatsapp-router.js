import { Router } from 'express';
import { WebhookController } from '../controller/webhook-controller.js';
import { verifyMetaSignature } from '../middlewares/verify-meta-signature.js';

export const router = Router();

router.get("/", WebhookController.verifyWebhook);
router.post("/", verifyMetaSignature, WebhookController.receiveWebhook);
