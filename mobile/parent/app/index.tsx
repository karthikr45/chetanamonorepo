import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { isAuthenticated } from "../src/lib/auth";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    isAuthenticated().then((ok) => {
      router.replace(ok ? "/dashboard" : "/login");
    });
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
