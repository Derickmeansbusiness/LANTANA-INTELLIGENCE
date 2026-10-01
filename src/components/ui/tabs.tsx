"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-md border bg-surface p-0.5", className)}
      {...props}
    />
  );
}

/**
 * `panelless`: the tabs switch views by URL and render no TabsContent, so
 * there is no panel for aria-controls to point at (axe flags a dangling id).
 */
function TabsTrigger({ className, panelless, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger> & { panelless?: boolean }) {
  return (
    <TabsPrimitive.Trigger
      {...(panelless ? { "aria-controls": undefined } : {})}
      className={cn(
        "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-surface-2 data-[state=active]:text-foreground [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

const TabsContent = TabsPrimitive.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
