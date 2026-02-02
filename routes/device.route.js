import express from 'express';
import {
  createDevice,
  testDeviceConnection,
  activateDevice,
  deactivateDevice,
  getDevicesByCompany,
  updateDevice,
  deleteDevice
} from '../controller/device.controller.js';

const router = express.Router();

router.post('/', createDevice);
router.get('/company/:companyId', getDevicesByCompany);
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);
router.post('/:id/test', testDeviceConnection);
router.post('/:id/start', activateDevice);
router.post('/:id/stop', deactivateDevice);

export default router;