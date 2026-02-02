import express from 'express';
import {
  createVendorConfig,
  getVendorConfigsByCompany,
  updateVendorConfig,
  deleteVendorConfig
} from '../controller/vendorConfig.controller.js';

const router = express.Router();

router.post('/', createVendorConfig);

router.get('/company/:companyId', getVendorConfigsByCompany);

router.patch('/:id', updateVendorConfig);

router.delete('/:id', deleteVendorConfig);

export default router;
