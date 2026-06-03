import { IdentityProfileContent } from "./IdentityProfileContent";

export default async function IdentityProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IdentityProfileContent identityId={id} />;
}
