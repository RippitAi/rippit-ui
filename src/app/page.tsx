import { redirect } from "next/navigation";

/*
 * The app opens straight into the dashboard — no connect gate. Platforms
 * are connected and managed from Settings → Connections.
 */
export default function Home() {
  redirect("/dashboard");
}
