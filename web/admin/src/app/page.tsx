import type { Metadata } from "next";
import { LoginPage } from "./LoginPage";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your account",
};

export default function RootPage() {
  return <LoginPage />;
}
