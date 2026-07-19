import { redirect } from "next/navigation";
import { DEFAULT_CITY_SLUG } from "@/config/cities";

export default function RootPage() {
  redirect(`/${DEFAULT_CITY_SLUG}`);
}
