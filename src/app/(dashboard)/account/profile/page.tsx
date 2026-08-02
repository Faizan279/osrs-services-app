import { Badge } from "@/components/ui/badge";
import { CustomerProfileForm } from "@/components/customer-account-forms";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerProfile } from "@/lib/customer/account";

export const metadata = {
  title: "Customer profile",
  robots: { index: false, follow: false },
};

export default async function CustomerProfilePage() {
  const session = await requireCustomer("/account/profile");
  const profile = await getCustomerProfile(session.user.id);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="info">Private profile</Badge>
      <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
        Profile
      </h1>
      <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
        Profile edits never rewrite guest checkout contacts or historical order
        item snapshots.
      </p>
      <section className="surface-panel mt-8 rounded-2xl p-6">
        <CustomerProfileForm profile={profile} />
      </section>
    </main>
  );
}
