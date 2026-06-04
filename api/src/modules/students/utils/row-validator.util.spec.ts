import { validateAndNormalise, BillingContext } from './row-validator.util';
import { EXCEL_COLUMNS, monthFeeCol, monthDiscountCol, monthPickupCol, monthDropCol } from '../constants/excel.constants';
import { BILLING_MODE } from '../../../common/constants/tenant';
import { MonthType } from '../../fees/entities/fee.entity';

const transportCtx: BillingContext = {
  billingMode: BILLING_MODE.MONTHLY,
  isTransport: true,
};
const hostelMonthlyCtx: BillingContext = {
  billingMode: BILLING_MODE.MONTHLY,
  isTransport: false,
};

function baseRow(): Record<string, unknown> {
  return {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-TR',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1001',
    [EXCEL_COLUMNS.NAME]: 'Arjun Kumar',
    [EXCEL_COLUMNS.EMAIL]: 'arjun@example.com',
    [EXCEL_COLUMNS.PHONE]: '+919876543210',
    [EXCEL_COLUMNS.CLASS]: '7',
    [EXCEL_COLUMNS.SECTION]: 'A',
    [EXCEL_COLUMNS.ROLL_NO]: '1',
  };
}

describe('validateAndNormalise — monthly per-month parsing', () => {
  it('produces one fee per filled month, with that month\'s pickup/drop', () => {
    const row = {
      ...baseRow(),
      [monthFeeCol(MonthType.APRIL)]: 3000,
      [monthDiscountCol(MonthType.APRIL)]: 200,
      [monthPickupCol(MonthType.APRIL)]: 'Kukatpally',
      [monthDropCol(MonthType.APRIL)]: 'School Gate',
      [monthFeeCol(MonthType.MAY)]: 3500,
      [monthPickupCol(MonthType.MAY)]: 'Miyapur',
      [monthDropCol(MonthType.MAY)]: 'School Gate',
    };

    const result = validateAndNormalise(row, transportCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.values).toHaveLength(2);
    const april = result.values.find((v) => v.term === MonthType.APRIL)!;
    expect(april.amount).toBe(3000);
    expect(april.discount).toBe(200);
    expect(april.pickupLocation).toBe('Kukatpally');
    expect(april.dropLocation).toBe('School Gate');

    const may = result.values.find((v) => v.term === MonthType.MAY)!;
    expect(may.amount).toBe(3500);
    expect(may.discount).toBe(0);
    expect(may.pickupLocation).toBe('Miyapur');
  });

  it('requires pickup/drop on a billed month for transport', () => {
    const row = {
      ...baseRow(),
      [monthFeeCol(MonthType.APRIL)]: 3000,
      // pickup/drop omitted
    };
    const result = validateAndNormalise(row, transportCtx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain(monthPickupCol(MonthType.APRIL));
    expect(fields).toContain(monthDropCol(MonthType.APRIL));
  });

  it('does not require pickup/drop for a non-transport monthly tenant', () => {
    const row = {
      ...baseRow(),
      [monthFeeCol(MonthType.APRIL)]: 3000,
    };
    const result = validateAndNormalise(row, hostelMonthlyCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toHaveLength(1);
    expect(result.values[0].pickupLocation).toBeNull();
  });

  it('rejects when no month is filled', () => {
    const result = validateAndNormalise(baseRow(), transportCtx);
    expect(result.ok).toBe(false);
  });

  it('rejects a month discount that exceeds its fee', () => {
    const row = {
      ...baseRow(),
      [monthFeeCol(MonthType.APRIL)]: 1000,
      [monthDiscountCol(MonthType.APRIL)]: 2000,
      [monthPickupCol(MonthType.APRIL)]: 'A',
      [monthDropCol(MonthType.APRIL)]: 'B',
    };
    const result = validateAndNormalise(row, transportCtx);
    expect(result.ok).toBe(false);
  });
});
