import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import {
  fetchDashboard,
  logout,
  type DashboardResponse,
} from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const d = await fetchDashboard();
      setData(d);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogout() {
    await logout();
    router.replace("/login");
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
      <View
        style={{
          paddingTop: 52,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: "#0b1026",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          shadowColor: "#0b1026",
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: "rgba(191,219,254,0.7)",
              letterSpacing: 1,
            }}
          >
            SVBK · PARENT PORTAL
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#fff",
              marginTop: 2,
            }}
          >
            Dashboard
          </Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
          }}
        >
          <Text style={{ color: "#fecaca", fontWeight: "700", fontSize: 13 }}>
            Sign out
          </Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            {error && (
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
            )}
            {data && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Stat label="Paid" value={inr(data.summary.totalPaid)} bg="#dcfce7" fg="#15803d" />
                <Stat label="Due" value={inr(data.summary.totalDue)} bg="#fef3c7" fg="#92400e" />
                <Stat label="Penalty" value={inr(data.summary.totalPenalty)} bg="#f1f5f9" fg="#334155" />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <NavBtn label="Payments" onPress={() => router.push("/payments")} />
              <NavBtn label="History" onPress={() => router.push("/payment-history")} />
              <NavBtn label="School Feed" onPress={() => router.push("/feed")} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 8 }}>
              Children
            </Text>
          </>
        }
        data={data?.children ?? []}
        keyExtractor={(item) => item.student.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => load()} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/fees?studentId=${item.student.id}`)
            }
            style={{
              padding: 16,
              backgroundColor: "#fff",
              borderRadius: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: "#e2e8f0",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
              {item.student.name}
            </Text>
            <Text style={{ color: "#64748b", marginTop: 2 }}>
              {item.student.class} · {item.student.section} · Roll {item.student.rollNo}
            </Text>
            <Text style={{ color: "#64748b" }}>
              Adm {item.student.admissionNumber} · {item.student.academicYear}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <Text style={{ color: "#64748b" }}>{item.feesCount} fee record(s)</Text>
              <Text style={{ color: item.amountDue > 0 ? "#b91c1c" : "#15803d", fontWeight: "700" }}>
                {item.amountDue > 0 ? `Due ${inr(item.amountDue)}` : "Up to date"}
              </Text>
            </View>
            <Text style={{ color: "#6c739c", fontWeight: "700", marginTop: 10 }}>
              View fees ›
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !error ? (
            <Text style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>
              No children linked. Ask the school admin to link your account.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function NavBtn({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: "#565c82",
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(99,102,241,0.45)",
        shadowColor: "#565c82",
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  bg,
  fg,
}: {
  label: string;
  value: string;
  bg: string;
  fg: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 12, borderRadius: 12 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: fg, fontSize: 16, fontWeight: "800", marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}
