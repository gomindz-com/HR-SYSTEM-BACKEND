import express from 'express';
import {
  createVendorConfig,
  getVendorConfigsByCompany,
  updateVendorConfig,
  deleteVendorConfig
} from '../controller/vendorConfig.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { checkSubscription } from '../middleware/subscription.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(checkSubscription);


router.get('/company', getVendorConfigsByCompany);

router.patch('/:id', updateVendorConfig);

router.delete('/:id', deleteVendorConfig);

export default router;
