import { getAppSettings } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const settings = await getAppSettings();

  return (
    <LoginForm
      businessName={settings.businessName}
      businessAddress={settings.businessAddress}
      businessPhone={settings.businessPhone}
      businessEmail={settings.businessEmail}
      logoUrl={settings.logoUrl}
    />
  );
}
