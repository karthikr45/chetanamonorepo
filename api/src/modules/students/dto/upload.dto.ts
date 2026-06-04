export enum RowStatus {
  VALID = 'VALID',
  ERROR = 'ERROR',
}

export interface ValidatedRow {
  rowNumber: number;
  status: RowStatus;
  message: string;
  isTermExists: boolean;
  data: Record<string, unknown>;
}

export class ValidateUploadResponseDto {
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ValidatedRow[];
}

export class ConfirmUploadResponseDto {
  message: string;
  studentsCreated: number;
  studentsUpdated: number;
  feesCreated: number;
  /** Existing current/upcoming-month fees revised by the upload. */
  feesUpdated?: number;
}
