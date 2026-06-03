import { ReceiptResetPolicy } from '../tenants/entities/tenant.entity';
import { PaymentStatus } from './entities/fee.entity';
import {
  guessAcademicYear,
  computePeriodKey,
  sanitizeReceiptPrefix,
  assembleReceiptNumber,
  assembleCompactReceiptNumber,
  compactAcademicYear,
  deriveStatus,
} from './fee-math';

describe('fee-math', () => {
  describe('guessAcademicYear (Apr–Mar boundary)', () => {
    it('April 1 starts the new academic year', () => {
      expect(guessAcademicYear(new Date('2025-04-01T00:00:00'))).toBe(
        '2025-2026',
      );
    });
    it('March 31 still belongs to the previous academic year', () => {
      expect(guessAcademicYear(new Date('2026-03-31T23:59:59'))).toBe(
        '2025-2026',
      );
    });
    it('Jan/Feb/Mar map to the previous start year', () => {
      expect(guessAcademicYear(new Date('2026-01-15'))).toBe('2025-2026');
    });
  });

  describe('computePeriodKey', () => {
    const d = new Date('2025-07-09T10:00:00');
    it('NEVER → single global bucket', () => {
      expect(computePeriodKey(ReceiptResetPolicy.NEVER, d, null)).toBe(
        'GLOBAL',
      );
    });
    it('YEARLY → calendar year', () => {
      expect(computePeriodKey(ReceiptResetPolicy.YEARLY, d, null)).toBe(
        '2025',
      );
    });
    it('MONTHLY → YYYY-MM zero padded', () => {
      expect(computePeriodKey(ReceiptResetPolicy.MONTHLY, d, null)).toBe(
        '2025-07',
      );
    });
    it('DAILY → YYYYMMDD zero padded', () => {
      expect(computePeriodKey(ReceiptResetPolicy.DAILY, d, null)).toBe(
        '20250709',
      );
    });
    it('ACADEMIC_YEAR → short form from explicit AY', () => {
      expect(
        computePeriodKey(ReceiptResetPolicy.ACADEMIC_YEAR, d, '2025-2026'),
      ).toBe('2025-26');
    });
    it('ACADEMIC_YEAR → falls back to the date guess when AY missing', () => {
      expect(
        computePeriodKey(ReceiptResetPolicy.ACADEMIC_YEAR, d, null),
      ).toBe('2025-26');
    });
    it('ACADEMIC_YEAR → returns an unparseable AY unchanged', () => {
      expect(
        computePeriodKey(ReceiptResetPolicy.ACADEMIC_YEAR, d, 'AY-1'),
      ).toBe('AY-1');
    });
  });

  describe('sanitizeReceiptPrefix', () => {
    it('uppercases and strips non-alphanumerics', () => {
      expect(sanitizeReceiptPrefix(' svbk-guntur ')).toBe('SVBKGUNTUR');
    });
    it('defaults to RCP when nullish', () => {
      expect(sanitizeReceiptPrefix(null)).toBe('RCP');
      expect(sanitizeReceiptPrefix(undefined)).toBe('RCP');
    });
  });

  describe('assembleReceiptNumber', () => {
    it('pads the sequence to 4 digits with the period segment', () => {
      expect(
        assembleReceiptNumber(
          'SVBK',
          ReceiptResetPolicy.ACADEMIC_YEAR,
          '2025-26',
          42,
        ),
      ).toBe('SVBK-2025-26-0042');
    });
    it('omits the period segment for NEVER', () => {
      expect(
        assembleReceiptNumber('SVBK', ReceiptResetPolicy.NEVER, 'GLOBAL', 7),
      ).toBe('SVBK-0007');
    });
    it('does not truncate sequences beyond 9999', () => {
      expect(
        assembleReceiptNumber(
          'SVBK',
          ReceiptResetPolicy.YEARLY,
          '2025',
          12345,
        ),
      ).toBe('SVBK-2025-12345');
    });
  });

  describe('compactAcademicYear', () => {
    it('joins the last two digits of each year', () => {
      expect(
        compactAcademicYear('2026-2027', new Date('2026-06-01T00:00:00')),
      ).toBe('2627');
    });
    it('falls back to the date when AY is missing/unparseable', () => {
      // June 2026 → academic year 2026-2027 → "2627"
      expect(compactAcademicYear(null, new Date('2026-06-01T00:00:00'))).toBe(
        '2627',
      );
      // Feb 2027 belongs to 2026-2027 as well
      expect(compactAcademicYear('garbage', new Date('2027-02-15T00:00:00'))).toBe(
        '2627',
      );
    });
  });

  describe('assembleCompactReceiptNumber', () => {
    it('builds {code}{AAYY}{####} with no separators', () => {
      expect(
        assembleCompactReceiptNumber('2', '2026-2027', new Date('2026-06-01T00:00:00'), 1),
      ).toBe('226270001');
    });
    it('sanitises the tenant code and pads the sequence', () => {
      expect(
        assembleCompactReceiptNumber('sv-bk', '2025-2026', new Date('2025-06-01'), 42),
      ).toBe('SVBK25260042');
    });
    it('grows past 4 digits without truncation', () => {
      expect(
        assembleCompactReceiptNumber('2', '2026-2027', new Date('2026-06-01'), 12345),
      ).toBe('2262712345');
    });
  });

  describe('deriveStatus (money state machine)', () => {
    it('0 paid → UNPAID', () => {
      expect(deriveStatus(0, 1000)).toBe(PaymentStatus.UNPAID);
    });
    it('part paid → PARTIAL', () => {
      expect(deriveStatus(400, 1000)).toBe(PaymentStatus.PARTIAL);
    });
    it('exactly net → PAID', () => {
      expect(deriveStatus(1000, 1000)).toBe(PaymentStatus.PAID);
    });
    it('over net → PAID (never regresses)', () => {
      expect(deriveStatus(1200, 1000)).toBe(PaymentStatus.PAID);
    });
  });
});
