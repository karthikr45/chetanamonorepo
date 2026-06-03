/**
 * Excel column headers for the bulk students+fees upload.
 *
 * Header strings are case-sensitive and must match what schools paste
 * into their Excel. Synonyms (e.g. "PHONE" / "Phone Number" / "Mobile")
 * should be normalised in the parser, not added here.
 *
 * The Excel is the *broad* view: it carries School Code + per-term
 * Discount so a single file can be uploaded with any number of
 * concession rules. The student's service (school/hostel/transport)
 * comes from the tenant the file is uploaded into, not a column.
 * The UI table view is the *compact* view computed from this data +
 * payment history.
 */
export const EXCEL_COLUMNS = {
  // Identity / placement
  SCHOOL_CODE: 'Code',
  ACADEMIC_YEAR: 'Academic Year',
  ADMISSION: 'ADMISSION',
  NAME: 'NAME',
  EMAIL: 'e-mail',
  PHONE: 'Phone number',
  CLASS: 'Class',
  SECTION: 'Section',
  ROLL_NO: 'Roll No',
  IMG_URL: 'imgUrl',

  // Monthly billing (used when the tenant's billing mode is monthly,
  // e.g. transport). One amount is billed for each month Apr–Mar.
  MONTHLY_FEE: 'Monthly Fee',
  MONTHLY_DISCOUNT: 'Monthly Discount',
  // Transport-only: pickup/drop maintained per student.
  PICKUP_LOCATION: 'Pickup Location',
  DROP_LOCATION: 'Drop Location',

  // Fees per term — original amount
  TERM_1: '1st Term Fee',
  TERM_2: '2nd Term Fee',
  TERM_3: '3rd Term Fee',
  TERM_4: '4th Term Fee',
  TERM_5: '5th Term Fee',

  // Discounts per term — sibling, staff, EWS, scholarship, etc.
  TERM_1_DISCOUNT: '1st Term Discount',
  TERM_2_DISCOUNT: '2nd Term Discount',
  TERM_3_DISCOUNT: '3rd Term Discount',
  TERM_4_DISCOUNT: '4th Term Discount',
  TERM_5_DISCOUNT: '5th Term Discount',
} as const;

export const REQUIRED_STUDENT_COLUMNS = [
  EXCEL_COLUMNS.SCHOOL_CODE,
  EXCEL_COLUMNS.ACADEMIC_YEAR,
  EXCEL_COLUMNS.ADMISSION,
  EXCEL_COLUMNS.NAME,
  EXCEL_COLUMNS.EMAIL,
  EXCEL_COLUMNS.PHONE,
  EXCEL_COLUMNS.CLASS,
  EXCEL_COLUMNS.SECTION,
  EXCEL_COLUMNS.ROLL_NO,
] as const;

export const TERM_COLUMNS = [
  EXCEL_COLUMNS.TERM_1,
  EXCEL_COLUMNS.TERM_2,
  EXCEL_COLUMNS.TERM_3,
  EXCEL_COLUMNS.TERM_4,
  EXCEL_COLUMNS.TERM_5,
] as const;

export const TERM_DISCOUNT_COLUMNS = [
  EXCEL_COLUMNS.TERM_1_DISCOUNT,
  EXCEL_COLUMNS.TERM_2_DISCOUNT,
  EXCEL_COLUMNS.TERM_3_DISCOUNT,
  EXCEL_COLUMNS.TERM_4_DISCOUNT,
  EXCEL_COLUMNS.TERM_5_DISCOUNT,
] as const;

/** Pairs of (fee column, discount column) — used by the parser to
 * generate one fee record per non-empty term. */
export const TERM_DEFINITIONS = [
  { feeCol: EXCEL_COLUMNS.TERM_1, discountCol: EXCEL_COLUMNS.TERM_1_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_2, discountCol: EXCEL_COLUMNS.TERM_2_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_3, discountCol: EXCEL_COLUMNS.TERM_3_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_4, discountCol: EXCEL_COLUMNS.TERM_4_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_5, discountCol: EXCEL_COLUMNS.TERM_5_DISCOUNT },
] as const;

/** Fee columns for a monthly-billing tenant. */
export const MONTHLY_FEE_COLUMNS = [
  EXCEL_COLUMNS.MONTHLY_FEE,
  EXCEL_COLUMNS.MONTHLY_DISCOUNT,
] as const;

/** Extra columns shown only for transport tenants. */
export const TRANSPORT_COLUMNS = [
  EXCEL_COLUMNS.PICKUP_LOCATION,
  EXCEL_COLUMNS.DROP_LOCATION,
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_ROWS = 10_000;

type SampleRow = Record<string, string | number>;

/**
 * Sample rows for the downloadable template. Each row demonstrates a
 * realistic Indian-school scenario so admins can see the format and
 * tweak values before saving + uploading back.
 */
export const SAMPLE_ROWS: SampleRow[] = [
  // 1. Standard CBSE student, 4 equal terms, no discount
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-MAIN',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1001',
    [EXCEL_COLUMNS.NAME]: 'Arjun Kumar',
    [EXCEL_COLUMNS.EMAIL]: 'arjun@example.com',
    [EXCEL_COLUMNS.PHONE]: '+919876543210',
    [EXCEL_COLUMNS.CLASS]: '7',
    [EXCEL_COLUMNS.SECTION]: 'A',
    [EXCEL_COLUMNS.ROLL_NO]: '1',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.TERM_1]: 25000,
    [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_2]: 25000,
    [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_3]: 25000,
    [EXCEL_COLUMNS.TERM_3_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_4]: 25000,
    [EXCEL_COLUMNS.TERM_4_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_5]: '',
    [EXCEL_COLUMNS.TERM_5_DISCOUNT]: '',
  },
  // 2. Sibling discount on every term (younger sibling)
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-MAIN',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1002',
    [EXCEL_COLUMNS.NAME]: 'Sneha Kumar',
    [EXCEL_COLUMNS.EMAIL]: 'sneha@example.com',
    [EXCEL_COLUMNS.PHONE]: '+919876543210',
    [EXCEL_COLUMNS.CLASS]: '4',
    [EXCEL_COLUMNS.SECTION]: 'B',
    [EXCEL_COLUMNS.ROLL_NO]: '12',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.TERM_1]: 22000,
    [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 2200,
    [EXCEL_COLUMNS.TERM_2]: 22000,
    [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 2200,
    [EXCEL_COLUMNS.TERM_3]: 22000,
    [EXCEL_COLUMNS.TERM_3_DISCOUNT]: 2200,
    [EXCEL_COLUMNS.TERM_4]: 22000,
    [EXCEL_COLUMNS.TERM_4_DISCOUNT]: 2200,
    [EXCEL_COLUMNS.TERM_5]: '',
    [EXCEL_COLUMNS.TERM_5_DISCOUNT]: '',
  },
  // 3. Different branch, 5 terms (Inter / Junior college)
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-GNT',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1003',
    [EXCEL_COLUMNS.NAME]: 'Lakshmi Reddy',
    [EXCEL_COLUMNS.EMAIL]: 'lakshmi@example.com',
    [EXCEL_COLUMNS.PHONE]: '+919012345678',
    [EXCEL_COLUMNS.CLASS]: 'Inter 1Y',
    [EXCEL_COLUMNS.SECTION]: 'MPC',
    [EXCEL_COLUMNS.ROLL_NO]: '7',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.TERM_1]: 18000,
    [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_2]: 18000,
    [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_3]: 18000,
    [EXCEL_COLUMNS.TERM_3_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_4]: 18000,
    [EXCEL_COLUMNS.TERM_4_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_5]: 18000,
    [EXCEL_COLUMNS.TERM_5_DISCOUNT]: 0,
  },
  // 4. Staff child — large concession
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-MAIN',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1004',
    [EXCEL_COLUMNS.NAME]: 'Pranav Rao',
    [EXCEL_COLUMNS.EMAIL]: 'pranav@example.com',
    [EXCEL_COLUMNS.PHONE]: '+918765432109',
    [EXCEL_COLUMNS.CLASS]: '9',
    [EXCEL_COLUMNS.SECTION]: 'A',
    [EXCEL_COLUMNS.ROLL_NO]: '3',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.TERM_1]: 30000,
    [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 15000,
    [EXCEL_COLUMNS.TERM_2]: 30000,
    [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 15000,
    [EXCEL_COLUMNS.TERM_3]: 30000,
    [EXCEL_COLUMNS.TERM_3_DISCOUNT]: 15000,
    [EXCEL_COLUMNS.TERM_4]: 30000,
    [EXCEL_COLUMNS.TERM_4_DISCOUNT]: 15000,
    [EXCEL_COLUMNS.TERM_5]: '',
    [EXCEL_COLUMNS.TERM_5_DISCOUNT]: '',
  },
  // 5. Half-yearly fee structure (only 2 terms used)
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-MAIN',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1000',
    [EXCEL_COLUMNS.NAME]: 'Anika Sharma',
    [EXCEL_COLUMNS.EMAIL]: 'anika@example.com',
    [EXCEL_COLUMNS.PHONE]: '+917654321098',
    [EXCEL_COLUMNS.CLASS]: 'LKG',
    [EXCEL_COLUMNS.SECTION]: 'A',
    [EXCEL_COLUMNS.ROLL_NO]: '5',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.TERM_1]: 35000,
    [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_2]: 35000,
    [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 0,
    [EXCEL_COLUMNS.TERM_3]: '',
    [EXCEL_COLUMNS.TERM_3_DISCOUNT]: '',
    [EXCEL_COLUMNS.TERM_4]: '',
    [EXCEL_COLUMNS.TERM_4_DISCOUNT]: '',
    [EXCEL_COLUMNS.TERM_5]: '',
    [EXCEL_COLUMNS.TERM_5_DISCOUNT]: '',
  },
];

/**
 * Sample rows for a monthly-billing tenant (hostel/transport). The
 * single Monthly Fee is billed for each month Apr–Mar. Transport rows
 * also carry pickup/drop locations.
 */
export const SAMPLE_ROWS_MONTHLY: SampleRow[] = [
  {
    [EXCEL_COLUMNS.SCHOOL_CODE]: 'SVBK-MAIN',
    [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2026-2027',
    [EXCEL_COLUMNS.ADMISSION]: '1000',
    [EXCEL_COLUMNS.NAME]: 'Arjun Kumar',
    [EXCEL_COLUMNS.EMAIL]: 'arjun@example.com',
    [EXCEL_COLUMNS.PHONE]: '+919876543210',
    [EXCEL_COLUMNS.CLASS]: '7',
    [EXCEL_COLUMNS.SECTION]: 'A',
    [EXCEL_COLUMNS.ROLL_NO]: '1',
    [EXCEL_COLUMNS.IMG_URL]: '',
    [EXCEL_COLUMNS.MONTHLY_FEE]: 3000,
    [EXCEL_COLUMNS.MONTHLY_DISCOUNT]: 0,
    [EXCEL_COLUMNS.PICKUP_LOCATION]: 'Kukatpally Bus Stop',
    [EXCEL_COLUMNS.DROP_LOCATION]: 'School Main Gate',
  },
];

/** Per-column help text shown on the Instructions sheet of the template. */
export const COLUMN_DESCRIPTIONS: { column: string; required: 'Yes' | 'No'; example: string; notes: string }[] = [
  { column: EXCEL_COLUMNS.SCHOOL_CODE,      required: 'Yes', example: 'SVBK-MAIN',      notes: 'School code. Shared across the school/hostel/transport tenants for the same institution.' },
  { column: EXCEL_COLUMNS.ACADEMIC_YEAR,    required: 'Yes', example: '2025-2026',      notes: 'Format YYYY-YYYY, end year = start year + 1.' },
  { column: EXCEL_COLUMNS.ADMISSION,        required: 'Yes', example: 'ADM-2024-001',   notes: 'Canonical student id. Stays the same year over year.' },
  { column: EXCEL_COLUMNS.NAME,             required: 'Yes', example: 'Arjun Kumar',    notes: 'Full name as on the school register.' },
  { column: EXCEL_COLUMNS.EMAIL,            required: 'Yes', example: 'arjun@example.com', notes: 'Used for parent/student communication.' },
  { column: EXCEL_COLUMNS.PHONE,            required: 'Yes', example: '+919876543210',  notes: '7–15 digits, optional leading + and country code.' },
  { column: EXCEL_COLUMNS.CLASS,            required: 'Yes', example: '7 / Inter 1Y',   notes: 'Free text. Use "Inter 1Y" / "Inter 2Y" for junior college.' },
  { column: EXCEL_COLUMNS.SECTION,          required: 'Yes', example: 'A / MPC',        notes: 'Section letter or stream (MPC/BiPC/CEC/MEC).' },
  { column: EXCEL_COLUMNS.ROLL_NO,          required: 'Yes', example: '1',              notes: 'Roll number within the section.' },
  { column: EXCEL_COLUMNS.IMG_URL,          required: 'No',  example: '',               notes: 'Optional photo URL (CDN/Cloudinary).' },
  { column: EXCEL_COLUMNS.TERM_1,           required: 'No',  example: '25000',          notes: '1st-term original fee in INR. Leave blank if not applicable.' },
  { column: EXCEL_COLUMNS.TERM_1_DISCOUNT,  required: 'No',  example: '0',              notes: '1st-term concession (sibling/staff/EWS/scholarship). Cannot exceed fee.' },
  { column: EXCEL_COLUMNS.TERM_2,           required: 'No',  example: '25000',          notes: '2nd-term original fee.' },
  { column: EXCEL_COLUMNS.TERM_2_DISCOUNT,  required: 'No',  example: '0',              notes: '2nd-term concession.' },
  { column: EXCEL_COLUMNS.TERM_3,           required: 'No',  example: '25000',          notes: '3rd-term original fee.' },
  { column: EXCEL_COLUMNS.TERM_3_DISCOUNT,  required: 'No',  example: '0',              notes: '3rd-term concession.' },
  { column: EXCEL_COLUMNS.TERM_4,           required: 'No',  example: '25000',          notes: '4th-term original fee.' },
  { column: EXCEL_COLUMNS.TERM_4_DISCOUNT,  required: 'No',  example: '0',              notes: '4th-term concession.' },
  { column: EXCEL_COLUMNS.TERM_5,           required: 'No',  example: '',               notes: '5th-term original fee. Most schools leave this blank.' },
  { column: EXCEL_COLUMNS.TERM_5_DISCOUNT,  required: 'No',  example: '',               notes: '5th-term concession.' },
];

/** Help text for the monthly-billing template (hostel/transport). */
export const COLUMN_DESCRIPTIONS_MONTHLY: { column: string; required: 'Yes' | 'No'; example: string; notes: string }[] = [
  { column: EXCEL_COLUMNS.SCHOOL_CODE,      required: 'Yes', example: 'SVBK-MAIN',      notes: 'School code. Same as the school tenant for this institution.' },
  { column: EXCEL_COLUMNS.ACADEMIC_YEAR,    required: 'Yes', example: '2025-2026',      notes: 'Format YYYY-YYYY, end year = start year + 1.' },
  { column: EXCEL_COLUMNS.ADMISSION,        required: 'Yes', example: 'ADM-2024-001',   notes: 'Same admission number as the school record (links the person).' },
  { column: EXCEL_COLUMNS.NAME,             required: 'Yes', example: 'Arjun Kumar',    notes: 'Full name.' },
  { column: EXCEL_COLUMNS.EMAIL,            required: 'Yes', example: 'arjun@example.com', notes: 'Used for parent/student communication.' },
  { column: EXCEL_COLUMNS.PHONE,            required: 'Yes', example: '+919876543210',  notes: '7–15 digits, optional leading +.' },
  { column: EXCEL_COLUMNS.CLASS,            required: 'Yes', example: '7',              notes: 'Free text.' },
  { column: EXCEL_COLUMNS.SECTION,          required: 'Yes', example: 'A',              notes: 'Section.' },
  { column: EXCEL_COLUMNS.ROLL_NO,          required: 'Yes', example: '1',              notes: 'Roll number.' },
  { column: EXCEL_COLUMNS.IMG_URL,          required: 'No',  example: '',               notes: 'Optional photo URL.' },
  { column: EXCEL_COLUMNS.MONTHLY_FEE,      required: 'Yes', example: '3000',           notes: 'Monthly fee in INR — billed for each month Apr–Mar.' },
  { column: EXCEL_COLUMNS.MONTHLY_DISCOUNT, required: 'No',  example: '0',              notes: 'Monthly concession. Cannot exceed the monthly fee.' },
  { column: EXCEL_COLUMNS.PICKUP_LOCATION,  required: 'No',  example: 'Kukatpally',     notes: 'Transport only. Required for transport tenants.' },
  { column: EXCEL_COLUMNS.DROP_LOCATION,    required: 'No',  example: 'School Gate',    notes: 'Transport only. Required for transport tenants.' },
];
