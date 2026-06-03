import { ScrollView, Text, View } from "react-native";

export default function Home() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a" }}>
        SVBK Students
      </Text>
      <Text style={{ color: "#64748b", marginTop: 6 }}>
        Mobile placeholder. The API does not yet expose student-facing
        endpoints. Once /api/student/* is added (auth + dashboard +
        timetable + results), wire this app the same way as the parent
        mobile app (mobile/parent).
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
          • Backend endpoints pending{"\n"}
          • Feature work pending
        </Text>
      </View>
    </ScrollView>
  );
}
