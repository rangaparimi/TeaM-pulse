import { AuthGate } from "@/components/AuthGate";
import { InternView } from "@/components/InternView";

export default async function InternPage(props: PageProps<"/intern/[id]">) {
  const { id } = await props.params;
  return (
    <AuthGate>
      <InternView internId={Number(id)} />
    </AuthGate>
  );
}
