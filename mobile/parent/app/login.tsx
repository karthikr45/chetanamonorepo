import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  sendOtp,
  verifyOtp,
  selectTenant,
  type TenantSelectionResponse,
} from "../src/lib/parent-portal";
import { apiErrorMessage } from "../src/lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp" | "select">("email");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] =
    useState<TenantSelectionResponse | null>(null);

  async function handleSendOtp() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const meta = await sendOtp(email.trim());
      if (meta.devOtp) {
        setOtp(meta.devOtp);
        setNotice(
          `Email delivery isn't configured. Development code: ${meta.devOtp}`,
        );
      } else if (meta.demoMode) {
        setNotice("Demo mode is on — enter any 6-digit code to continue.");
      } else {
        setNotice(null);
      }
      setStage("otp");
    } catch (err) {
      Alert.alert("Could not send OTP", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyOtp(email.trim(), otp);
      if (result.kind === "selection") {
        setSelection(result.selection);
        setStage("select");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      Alert.alert("Verification failed", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickTenant(parentId: string) {
    if (!selection) return;
    setBusy(true);
    try {
      await selectTenant(selection.selectionToken, parentId);
      router.replace("/dashboard");
    } catch (err) {
      Alert.alert("Could not open school", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#f1f5f9" }}
    >
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0f172a" }}>
          SVBK Parent
        </Text>
        <Text style={{ color: "#64748b", marginTop: 4 }}>
          {stage === "email"
            ? "Enter your registered email"
            : stage === "otp"
              ? `Enter the 6-digit OTP sent to ${email}`
              : "Choose your school"}
        </Text>

        {stage === "email" && (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={inputStyle}
            />
            <Pressable
              onPress={handleSendOtp}
              disabled={busy}
              style={[buttonStyle, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={buttonText}>Send OTP</Text>
              )}
            </Pressable>
          </>
        )}

        {stage === "otp" && (
          <>
            {notice && (
              <Text
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#fcd34d",
                  backgroundColor: "#fffbeb",
                  color: "#92400e",
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {notice}
              </Text>
            )}
            <TextInput
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              style={[inputStyle, { letterSpacing: 8, textAlign: "center" }]}
            />
            <Pressable
              onPress={handleVerify}
              disabled={busy}
              style={[buttonStyle, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setStage("email")} style={{ marginTop: 12 }}>
              <Text style={{ color: "#6c739c", textAlign: "center" }}>
                Use a different email
              </Text>
            </Pressable>
          </>
        )}

        {stage === "select" && selection && (
          <View style={{ marginTop: 20 }}>
            {selection.tenants.map((t) => (
              <Pressable
                key={t.parentId}
                onPress={() => handlePickTenant(t.parentId)}
                disabled={busy}
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  backgroundColor: "#fff",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}
                >
                  {t.tenantName || t.tenantCode || "School"}
                </Text>
                {t.tenantCode ? (
                  <Text style={{ color: "#64748b", marginTop: 2 }}>
                    {t.tenantCode}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  marginTop: 24,
  height: 48,
  paddingHorizontal: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#cbd5e1",
  backgroundColor: "#fff",
  fontSize: 16,
  color: "#0f172a",
};

const buttonStyle = {
  marginTop: 16,
  height: 48,
  borderRadius: 12,
  backgroundColor: "#6c739c",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const buttonText = {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700" as const,
};
