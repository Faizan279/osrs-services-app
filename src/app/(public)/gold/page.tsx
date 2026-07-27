import { redirect } from "next/navigation";

export const metadata = { title: "Gold trading" };

export default function GoldPage() {
  redirect("/services/gold/gold-trading");
}
