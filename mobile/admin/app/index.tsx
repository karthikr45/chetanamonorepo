import { ScrollView, Text, View } from "react-native";

export default function Home() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a" }}>
        SVBK Admin
      </Text>
      <Text style={{ color: "#64748b", marginTop: 6 }}>
        Mobile placeholder. Admins use password login (POST /api/auth/signin)
        and have access to tenants, students, fees, payments, and parent
        management. Wire screens following the pattern in the parent mobile
        app (mobile/parent).
      </Text>
      <View
        style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: "#f1f5f9",
          borderRadius: 12,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Status</Text>
        <Text style={{ color: "#334155", lineHeight: 22 }}>
          • Expo Router scaffold ✓{"\n"}
          • API base URL via app.json extra ✓{"\n"}
          • Feature work pending — login + dashboard screens
        </Text>
      </View>
    </ScrollView>
  );
}
