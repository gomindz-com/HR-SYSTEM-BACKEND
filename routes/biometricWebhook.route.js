import express from 'express';
import { biometricWebhookController } from '../controller/biometricWebhook.controller';
const router = express.Router();


router.post('/webhook/:vendor/:deviceId', biometricWebhookController)
export default router;