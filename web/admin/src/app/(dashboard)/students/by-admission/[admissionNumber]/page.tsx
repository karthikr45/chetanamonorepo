import { ByAdmissionResolver } from "./ByAdmissionResolver";

export default async function ByAdmissionPage({
  params,
}: {
  params: Promise<{ admissionNumber: string }>;
}) {
  const { admissionNumber } = await params;
  return <ByAdmissionResolver admissionNumber={decodeURIComponent(admissionNumber)} />;
}
