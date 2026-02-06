import express from 'express';
import {
  createDevice,
  testDeviceConnection,
  activateDevice,
  deactivateDevice,
  getDevicesByCompany,
  updateDevice,
  deleteDevice,
} from '../controller/device.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { checkSubscription } from '../middleware/subscription.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(checkSubscription);

router.post('/', createDevice);
router.get('/company', getDevicesByCompany);
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);
router.post('/:id/test', testDeviceConnection);
router.post('/:id/start', activateDevice);
router.post('/:id/stop', deactivateDevice);
export default router;