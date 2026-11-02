import { Redirect } from "expo-router";

// Notifications now live in the "كيف نساعدك؟" screen (support + notifications tabs).
export default function NotificationsRedirect() {
  return <Redirect href={{ pathname: "/support", params: { tab: "notifications" } }} />;
}
