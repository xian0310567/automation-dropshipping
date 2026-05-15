import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tone, WorkRow } from "./monitoring-data";

export const toneClass: Record<Tone, string> = {
  teal: "tone-teal",
  red: "tone-red",
  amber: "tone-amber",
  blue: "tone-blue",
  neutral: "tone-neutral",
};

export function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: Tone;
}) {
  return (
    <Badge className={`ops-pill ${toneClass[tone]}`} variant={tone === "red" ? "destructive" : "secondary"}>
      {children}
    </Badge>
  );
}

export function ActionLink({ row }: { row: WorkRow }) {
  const className = `ops-action ${toneClass[row.actionTone]}`;
  const variant = row.actionTone === "neutral" ? "outline" : row.actionTone === "red" ? "destructive" : "default";

  if (row.href) {
    return (
      <Button asChild className={className} size="sm" variant={variant}>
        <Link href={row.href}>{row.action}</Link>
      </Button>
    );
  }

  return (
    <Button type="button" className={className} size="sm" variant={variant}>
      {row.action}
    </Button>
  );
}
