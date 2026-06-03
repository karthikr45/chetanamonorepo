import { KeyValueField } from "@/components/common";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Tenant } from "@/features/tenants/tenantData";

type TenantDetailsTabProps = {
  tenant: Tenant;
};

export default function TenantDetailsTab({ tenant }: TenantDetailsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>School information</CardTitle>
          <CardDescription>Identity and metadata for this tenant.</CardDescription>
        </CardHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <KeyValueField label="School name" value={(tenant as any).schoolName ?? tenant.name} />
          <KeyValueField label="School code" value={(tenant as any).schoolCode ?? tenant.code} />
          <KeyValueField label="Tenant code" value={tenant.tenantCode} />
          <KeyValueField label="Campus" value={tenant.tenantName} />
          {tenant.medium && <KeyValueField label="Medium" value={tenant.medium} />}
          {tenant.boardType && <KeyValueField label="Board" value={tenant.boardType} />}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Where this campus is located.</CardDescription>
        </CardHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <KeyValueField label="Address" value={tenant.address ?? ""} />
          <KeyValueField label="City" value={tenant.city ?? ""} />
          <KeyValueField label="State" value={tenant.state ?? ""} />
          <KeyValueField label="Country" value={tenant.country ?? ""} />
        </div>
      </Card>
    </div>
  );
}
