import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import {
  fetchPaymentHistory,
  type PaymentHistoryResponse,
  type PaymentHistoryRow,
} from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";
import { Header } from "./fees";

const inr = (v: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function badgeFor(row: PaymentHistoryRow): { label: string; color: string } {
  if (row.clearanceStatus === "PENDING")
    return { label: "Pending", color: "#92400e" };
  if (row.clearanceStatus === "BOUNCED")
    return { label: "Bounced", color: "#b91c1c" };
  return { label: "Paid", color: "#15803d" };
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const [data, setData] = useState<PaymentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await fetchPaymentHistory());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const rows = data?.payments ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#f1f5f9" }}>
      <Header title="Payment History" onBack={() => router.back()} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={rows}
        keyExtractor={(p) => p.paymentId}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListHeaderComponent={
          <View>
            {error ? (
              <View
                style={{
                  padding: 12,
                  marginBottom: 12,
                  backgroundColor: "#fee2e2",
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#b91c1c" }}>{error}</Text>
              </View>
            ) : null}
            {data && rows.length > 0 ? (
              <Text
                style={{ color: "#64748b", marginBottom: 12, fontSize: 13 }}
              >
                Total paid across all schools:{" "}
                <Text style={{ color: "#0f172a", fontWeight: "800" }}>
                  {inr(data.totalPaid)}
                </Text>
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const b = badgeFor(item);
          return (
            <View
              style={{
                padding: 16,
                backgroundColor: "#fff",
                borderRadius: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "#e2e8f0",
              }}
            >
              <View
                style={{ flexDirection: "row", justifyContent: "space-between" }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}
                >
                  {inr(item.amount)}
                </Text>
                <Text style={{ color: b.color, fontWeight: "700" }}>
                  {b.label}
                </Text>
              </View>
              <Text style={{ color: "#475569", marginTop: 4, fontWeight: "600" }}>
                {item.tenantName}
              </Text>
              <Text style={{ color: "#64748b", marginTop: 2, fontSize: 13 }}>
                {item.studentName ?? "—"}
                {item.term ? ` · ${item.term}` : ""}
                {item.academicYear ? ` · ${item.academicYear}` : ""}
              </Text>
              <Text style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                {item.method ? `${item.method} · ` : ""}
                {new Date(item.paidAt ?? item.createdAt).toLocaleString("en-IN")}
                {item.receiptNumber ? ` · #${item.receiptNumber}` : ""}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          !error ? (
            <Text
              style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}
            >
              No payments yet.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
