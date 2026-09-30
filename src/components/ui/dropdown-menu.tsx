"use client";

import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

const DropdownMenu = M.Root;
const DropdownMenuTrigger = M.Trigger;
const DropdownMenuGroup = M.Group;

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 rounded-lg border bg-surface p-1 shadow-xl shadow-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

const DropdownMenuRadioGroup = M.RadioGroup;
function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm outline-none select-none data-[highlighted]:bg-surface-2",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <M.ItemIndicator>
          <span className="block size-1.5 rounded-full bg-gold" />
        </M.ItemIndicator>
      </span>
      {children}
    </M.RadioItem>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
};
