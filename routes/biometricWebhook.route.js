import express from 'express';
import { 
    biometricWebhookController, 
    zktecoAdmsController 
} from '../controller/biometricWebhook.controller.js';

const router = express.Router();


// 2. Generic Webhook (Legacy or other Cloud Vendors)
router.post('/webhook/:vendor/:deviceId', biometricWebhookController);

export default router;