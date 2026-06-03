import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import {
  MAX_UPLOAD_ROWS,
  REQUIRED_STUDENT_COLUMNS,
  TERM_COLUMNS,
} from '../constants/excel.constants';

export interface ParsedRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ParsedWorkbook {
  headers: string[];
  rows: ParsedRow[];
}

export function parseExcel(buffer: Buffer): ParsedWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch {
    throw new BadRequestException(
      'The uploaded file is not a valid Excel or CSV file.',
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException('The uploaded file contains no sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  if (!raw.length) {
    throw new BadRequestException('The uploaded file is empty.');
  }

  const headers = (raw[0] as unknown[]).map((h) => String(h ?? '').trim());
  assertHeaders(headers);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const rowArr = raw[i] as unknown[];
    if (!rowArr || rowArr.every((v) => v === null || v === '')) continue;

    const values: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      const cell = rowArr[idx];
      values[header] = typeof cell === 'string' ? cell.trim() : cell;
    });
    rows.push({ rowNumber: i + 1, values });
  }

  if (!rows.length) {
    throw new BadRequestException('The uploaded file has no data rows.');
  }
  if (rows.length > MAX_UPLOAD_ROWS) {
    throw new BadRequestException(
      `Upload exceeds the maximum of ${MAX_UPLOAD_ROWS} rows.`,
    );
  }

  return { headers, rows };
}

function assertHeaders(headers: string[]): void {
  const headerSet = new Set(headers);
  const missing = REQUIRED_STUDENT_COLUMNS.filter((c) => !headerSet.has(c));
  if (missing.length) {
    throw new BadRequestException(
      `Missing required columns: ${missing.join(', ')}`,
    );
  }
  const hasAnyTerm = TERM_COLUMNS.some((c) => headerSet.has(c));
  if (!hasAnyTerm) {
    throw new BadRequestException(
      `The file must contain at least one term column (${TERM_COLUMNS.join(', ')}).`,
    );
  }
}