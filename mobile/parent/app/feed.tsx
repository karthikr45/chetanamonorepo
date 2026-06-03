import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { fetchFeed, type FeedPost } from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";
import { Header } from "./fees";

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setPosts(await fetchFeed());
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
      <Header title="School Feed" onBack={() => router.back()} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={posts}
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
            {item.title ? (
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}
              >
                {item.title}
              </Text>
            ) : null}
            {item.body ? (
              <Text style={{ color: "#334155", marginTop: 6, lineHeight: 20 }}>
                {item.body}
              </Text>
            ) : null}
            {item.images && item.images.length > 0 ? (
              <Image
                source={{ uri: item.images[0].url }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 10,
                  marginTop: 10,
                  backgroundColor: "#e2e8f0",
                }}
                resizeMode="cover"
              />
            ) : null}
            <Text style={{ color: "#94a3b8", marginTop: 8, fontSize: 12 }}>
              {new Date(item.createdAt).toLocaleString("en-IN")}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          !error ? (
            <Text
              style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}
            >
              No posts yet.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
