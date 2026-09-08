import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Plain-language explanation attached to a stats-card title via a "?" icon
// — the app shows a lot of trading/statistics jargon (SQN, Kelly, Profit
// Factor, ECE...) with no explanation otherwise.
export function StatLabel({ label, explain }: { label: string; explain: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger className="cursor-help align-middle text-muted-foreground/70 hover:text-muted-foreground">
          <CircleHelp className="size-3" />
        </TooltipTrigger>
        <TooltipContent>{explain}</TooltipContent>
      </Tooltip>
    </span>
  );
}
