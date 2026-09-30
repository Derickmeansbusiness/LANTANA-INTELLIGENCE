"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" themes={["dark", "light"]} enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-surface !border-border !text-foreground !rounded-lg",
              description: "!text-muted-foreground",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
