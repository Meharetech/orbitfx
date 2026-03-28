const express = require('express');
const router = express.Router();
const { 
  getPublicPaymentMethods, 
  getAdminPaymentMethods, 
  addPaymentMethod, 
  deletePaymentMethod, 
  togglePaymentStatus,
  updatePaymentMethod
} = require('../controllers/paymentController');

// All payment routes are admin protected except public list
router.get('/public', getPublicPaymentMethods);

// Administrative Routes
router.get('/admin', getAdminPaymentMethods);
router.post('/', addPaymentMethod);
router.put('/:id', updatePaymentMethod);
router.delete('/:id', deletePaymentMethod);
router.patch('/:id/toggle', togglePaymentStatus);

module.exports = router;
