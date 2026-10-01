/** Where a record of a given type lives in the app. Unknown types open in the record sheet. */
export function entityHref(type: string | null | undefined, id: string | null | undefined): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "deal":
      return `/deals/${id}`;
    case "organization":
      return `/partners/${id}`;
    case "contract":
      return `/contracts/${id}`;
    case "document":
      return `/documents/${id}`;
    case "task":
      return `?task=${id}`;
    case "project":
      return `/tasks/projects/${id}`;
    case "invoice":
      return `/finance/invoices/${id}`;
    case "bill":
      return "/finance/bills";
    case "employee":
      return `/people/${id}`;
    case "compliance_item":
      return "/compliance";
    case "corporate_record":
      return "/compliance/records";
    case "report_schedule":
      return `/reports/view?schedule=${id}`;
    case "data_room":
      return `/data-rooms/${id}`;
    default:
      return `?record=${type}:${id}`;
  }
}
