/**
 * The fee-payment ledger has been consolidated into the single `payments`
 * table (see payments/entities/payment.entity.ts). This module re-exports the
 * unified `Payment` entity and its enums under the historical names so the
 * rest of the codebase keeps compiling:
 *
 *   - `FeePayment`   → `Payment`        (the unified ledger entity / table)
 *   - `PaymentType`  → `PaymentMethod`  (the concrete instrument enum)
 *   - `ClearanceStatus`                 (unchanged)
 *
 * There is no separate `fee_payments` table anymore.
 */
export {
  Payment as FeePayment,
  PaymentMethod as PaymentType,
  ClearanceStatus,
} from '../../payments/entities/payment.entity';
