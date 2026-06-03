"use client";
import { useEffect } from "react";

export function usePaymentDetails() {


    // const fetchPaymentDetails = useCallback(async () => {
    //     const paymentDetails = await getPaymentDetails();
    //     setPaymentDetails(paymentDetails);
    // }, []);

    useEffect(() => {
        // fetchPaymentDetails();
    }, []);
  return {
    paymentDetails: [],
  };
}