export type TermFeeItem = {
  feeId?: string;
  amount: number;
  paidAmount: number;
  penaltyAmount: number;
  totalDiscount?: number;
  amountAfterDiscount?: number;
  paymentStatus: string;
  paymentType?: string;
  feePaid?: number;
  paymentDate?: string;
  paymentDates?: string[];
  receiptDate?: string;
  paymentTowards?: string;
  remarks?: string;
  bankName?: string;
  bankBranch?: string;
  ddNumber?: string;
  ddFileName?: string;
  originalAmount?: number;
  /** Transport (monthly) only — this period's boarding / drop point. */
  pickupLocation?: string | null;
  dropLocation?: string | null;
};

/** Term fees keyed by term name e.g. "1st Term Fee" -> { amount, paymentStatus } */
export type StudentFeeRow = {
  id: string;
  _id: string;
  name: string;
  class: string;
  section: string;
  rollNo: string;
  admissionNumber: string;
  phone: string;
  email: string;
  amount: string;
  status: "Paid" | "Pending";
  feeId?: string;
  /** Set when this enrollment has had a TC issued. */
  tcIssuedAt?: string | null;
  /** Canonical person identity (for the full-history view). */
  identityId?: string | null;
  /** Transport boarding / drop point. */
  pickupLocation?: string | null;
  dropLocation?: string | null;
  /** Term-wise fee: "1st Term Fee" -> { amount, paymentStatus } */
  termFees: Record<string, TermFeeItem>;
};

/** API response shape: results array replaces table rows */
export type GetStudentsDetailsResponse = { results: StudentFeeRow[] };

export type LatestStudent = {
  id: string;
  tenantId: string;
  branch: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  email: string;
  phoneNumber: string;
  class: string;
  section: string;
  rollNo: string;
  imgUrl: string | null;
};

export type AcademicYearItem = {
  id: string;
  _id?: string;
  academicYear: string;
  isCurrentYear: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
};
