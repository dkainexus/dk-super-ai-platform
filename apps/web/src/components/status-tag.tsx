import { OWNER_STATUS_LABEL, COMPANY_STATUS_LABEL, type OwnerStatus, type CompanyStatus } from "@/lib/types";

const STYLES: Record<OwnerStatus, string> = {
  draft: "bg-surface-raised text-muted",
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
  banned: "bg-danger/25 text-danger",
};

const COMPANY_STYLES: Record<CompanyStatus, string> = {
  preparing: "bg-warning/15 text-warning",
  registered: "bg-success/15 text-success",
  closed: "bg-surface-raised text-muted",
  banned: "bg-danger/25 text-danger",
};

export function CompanyStatusTag({ status }: { status: CompanyStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COMPANY_STYLES[status]}`}>
      {COMPANY_STATUS_LABEL[status]}
    </span>
  );
}

export function OwnerStatusTag({ status }: { status: OwnerStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {OWNER_STATUS_LABEL[status]}
    </span>
  );
}

export function ActiveTag({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? "bg-success/15 text-success" : "bg-surface-raised text-muted"
      }`}
    >
      {active ? on : off}
    </span>
  );
}
