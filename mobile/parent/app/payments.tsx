import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { fetchPayments, type Payment } from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";
import { Header } from "./fees";

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const STATUS_FG: Record<string, string> = {
  paid: "#15803d",
  created: "#92400e",
  failed: "#b91c1c",
  refunded: "#334155",
};

export default function PaymentsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setRows(await fetchPayments());
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f1f5f9" }}>
      <Header title="Payment History" onBack={() => router.back()} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={rows}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} />
        }
        ListHeaderComponent={
          error ? (
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
          ) : null
        }
        renderItem={({ item }) => (
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
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}
              >
                {inr(item.amount)}
              </Text>
              <Text
                style={{
                  color: STATUS_FG[item.status] ?? "#334155",
                  fontWeight: "700",
                  textTransform: "capitalize",
                }}
              >
                {item.status}
              </Text>
            </View>
            <Text style={{ color: "#64748b", marginTop: 4 }}>
              {item.gateway ? `${item.gateway} · ` : ""}
              {item.paymentType}
            </Text>
            <Text style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
              {new Date(item.paidAt ?? item.createdAt).toLocaleString("en-IN")}
            </Text>
          </View>
        )}
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
