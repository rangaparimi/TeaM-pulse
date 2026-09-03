import { AcceptInviteForm } from "@/components/AcceptInviteForm";

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Welcome to TeaM Pulse</h1>
      <p className="mt-2 text-sm text-muted">Set a password to finish setting up your account.</p>
      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
