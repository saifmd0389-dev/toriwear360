/**
 * TORIWEAR Server-Side Validation Schemas
 * Enforces strict payload verification before hitting database/service layer.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLoginInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body?.identifier || typeof body.identifier !== 'string' || !body.identifier.trim()) {
    errors.push('Identifier (email or employee ID) is required.');
  }
  if (!body?.password || typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('Password must be at least 6 characters.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateCreateOrderInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body?.customerName || typeof body.customerName !== 'string' || !body.customerName.trim()) {
    errors.push('Customer full name is required.');
  }
  if (!body?.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail)) {
    errors.push('A valid customer email address is required.');
  }
  if (!body?.customerPhone || body.customerPhone.trim().length < 10) {
    errors.push('A valid 10-digit mobile number is required.');
  }
  if (!body?.shippingAddress || typeof body.shippingAddress !== 'object') {
    errors.push('Shipping address is required.');
  } else {
    if (!body.shippingAddress.addressLine1?.trim()) {
      errors.push('Address line 1 is required.');
    }
    if (!body.shippingAddress.pincode?.trim() || !/^\d{6}$/.test(body.shippingAddress.pincode.trim())) {
      errors.push('A valid 6-digit Indian PIN code is required.');
    }
  }
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    errors.push('At least one catalog item must be present in order.');
  } else {
    for (const item of body.items) {
      if (!item.productId || typeof item.productId !== 'string') {
        errors.push('Product ID is missing on cart item.');
      }
      if (!item.size || typeof item.size !== 'string') {
        errors.push('Size is required for apparel items.');
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 10) {
        errors.push('Quantity must be an integer between 1 and 10.');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateQuoteOrderInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    errors.push('At least one item must be provided for quote calculation.');
  } else {
    for (const item of body.items) {
      if (!item.productId || typeof item.productId !== 'string') {
        errors.push('Item must have a valid productId string.');
      }
      if (item.quantity !== undefined && (typeof item.quantity !== 'number' || item.quantity < 1)) {
        errors.push('Item quantity must be a positive number.');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateUpdateOrderStatusInput(body: any): ValidationResult {
  const errors: string[] = [];
  const validStatuses = [
    'PENDING_PAYMENT',
    'PAYMENT_PENDING',
    'PAID',
    'CONFIRMED',
    'PROCESSING',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
    'REFUNDED',
    'RETURN_REQUESTED',
    'RETURNED',
  ];
  if (!body?.status || typeof body.status !== 'string') {
    errors.push('A valid status string is required.');
  } else if (!validStatuses.includes(body.status.toUpperCase())) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateCancelOrderInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body?.reason || typeof body.reason !== 'string' || !body.reason.trim()) {
    errors.push('A cancellation reason is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function validatePaymentIntentInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body?.orderId || typeof body.orderId !== 'string') {
    errors.push('Order ID is required to create a payment intent.');
  }
  return { valid: errors.length === 0, errors };
}

export function validatePaymentVerificationInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body?.orderId || typeof body.orderId !== 'string') {
    errors.push('Order ID is required for verification.');
  }
  if (!body?.gatewayOrderId || typeof body.gatewayOrderId !== 'string') {
    errors.push('Gateway Order ID is required.');
  }
  if (!body?.gatewayPaymentId || typeof body.gatewayPaymentId !== 'string') {
    errors.push('Gateway Payment ID is required.');
  }
  return { valid: errors.length === 0, errors };
}
