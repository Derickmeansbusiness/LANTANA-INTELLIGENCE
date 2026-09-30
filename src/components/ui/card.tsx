import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("min-w-0 rounded-lg border bg-card text-card-foreground", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-2 sm:px-5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-medium tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4 sm:px-5", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
