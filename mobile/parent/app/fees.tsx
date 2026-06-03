import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import {
  fetchFees,
  getParentWebUrl,
  type Fee,
} from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";

const inr = (v: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const STATUS: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "#dcfce7", fg: "#15803d" },
  PARTIAL: { bg: "#fef3c7", fg: "#92400e" },
  UNPAID: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function FeesScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setFees(await fetchFees(studentId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [studentId]);

  function handlePay() {
    const url = `${getParentWebUrl()}/dashboard`;
    Alert.alert(
      "Pay online",
      "You'll be taken to the secure web portal to complete the payment.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => Linking.openURL(url) },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f1f5f9" }}>
      <Header title="Fees" onBack={() => router.back()} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={fees}
        keyExtractor={(f) => f.id}
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
        renderItem={({ item }) => {
          const bal = Number(item.netAmount) - Number(item.paidAmount);
          const s = STATUS[item.paymentStatus] ?? STATUS.UNPAID;
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
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}
                >
                  {item.term}
                </Text>
                <View
                  style={{
                    backgroundColor: s.bg,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{ color: s.fg, fontSize: 12, fontWeight: "700" }}
                  >
                    {item.paymentStatus}
                  </Text>
                </View>
              </View>
              <Text style={{ color: "#64748b", marginTop: 4 }}>
                {item.academicYear}
              </Text>
              <Row label="Net" value={inr(item.netAmount)} />
              <Row label="Paid" value={inr(item.paidAmount)} />
              {bal > 0 && (
                <Row label="Balance" value={inr(bal)} danger />
              )}
              {bal > 0 && item.paymentStatus !== "PAID" && (
                <Pressable
                  onPress={handlePay}
                  style={{
                    marginTop: 12,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#6c739c",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Pay {inr(bal)}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !error ? (
            <Text
              style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}
            >
              No fee records found.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 6,
      }}
    >
      <Text style={{ color: "#64748b" }}>{label}</Text>
      <Text
        style={{ color: danger ? "#b91c1c" : "#0f172a", fontWeight: "700" }}
      >
        {value}
      </Text>
    </View>
  );
}

export function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: 52,
        paddingHorizontal: 20,
        paddingBottom: 18,
        backgroundColor: "#0b1026",
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        shadowColor: "#0b1026",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <Pressable
        onPress={onBack}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.10)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.16)",
        }}
      >
        <Text style={{ color: "#bfdbfe", fontWeight: "700", fontSize: 14 }}>
          ‹ Back
        </Text>
      </Pressable>
      <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
        {title}
      </Text>
    </View>
  );
}
