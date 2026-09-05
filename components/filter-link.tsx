import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function FilterLink({
  basePath,
  searchParams,
  paramKey,
  value,
  label,
  active,
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  paramKey: string;
  value: string | undefined;
  label: string;
  active: boolean;
}) {
  const next = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v !== undefined) as [
      string,
      string,
    ][]
  );
  if (value === undefined) {
    next.delete(paramKey);
  } else {
    next.set(paramKey, value);
  }
  const qs = next.toString();
  return (
    <Link href={qs ? `${basePath}?${qs}` : basePath}>
      <Badge variant={active ? "default" : "outline"}>{label}</Badge>
    </Link>
  );
}
