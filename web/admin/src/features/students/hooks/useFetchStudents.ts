"use client";

import { useState, useCallback, useEffect } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import type { StudentFeeRow, AcademicYearItem } from "@/features/students/types";
import { getStudentsByBranch } from "@/features/students/services";
import { getAcademicYears } from "@/features/students/services/students.service";
import { addPenaltyApi, waivePenaltyApi } from "../api/students.api";

export function useFetchStudents(branch: string, academicYear: string) {
  const [data, setData] = useState<StudentFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!academicYear) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await getStudentsByBranch(branch, academicYear);
      setData(rows);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load students"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [branch, academicYear]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { data, loading, error, refetch: fetchStudents };
}

export function useFetchAcademicYears() {
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcademicYears = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const years = await getAcademicYears();
    
      setAcademicYears(years);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load academic years"));
      setAcademicYears([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  return { academicYears, loading, error, refetch: fetchAcademicYears };
}

export function useAddPenalty(
  academicYear: string,
  term: string,
  amount: number,
  payload?: { applyToAll: boolean; admissionNumbers: string[] }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addPenalty = useCallback(async () => {
    if (!academicYear || !term || !Number.isFinite(amount) || amount <= 0) {
      setError("Please select academic year, term, and enter a valid penalty amount");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      await addPenaltyApi(academicYear, term, amount, payload);
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to add penalty"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [academicYear, term, amount, payload]);
  return { loading, error, addPenalty };
}

export function useWaivePenalty(
  academicYear: string,
  term: string,
  payload?: { applyToAll: boolean; admissionNumbers: string[] }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waivePenalty = useCallback(async () => {
    if (!academicYear || !term) {
      setError("Please select academic year and term");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      await waivePenaltyApi(academicYear, term, payload);
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to waive penalty"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [academicYear, term, payload]);

  return { loading, error, waivePenalty };
}


