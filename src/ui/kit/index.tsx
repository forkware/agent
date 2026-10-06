// Building blocks shared by the core UI and plugins, so every addition looks native.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { forwardRef, useEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StatusColor } from "../../sdk/types.ts";
import { t } from "../i18n.ts";

export { clsx as cx };

// Buttons

type Variant = "primary" | "secondary" | "ghost" | "danger" | "glow";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:brightness-110",
  secondary: "bg-raised text-text border border-line hover:bg-hover",
  ghost: "text-muted hover:text-text hover:bg-hover",
  danger: "bg-danger text-white hover:brightness-110",
  glow:
    "text-accent-text bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_0_1px_rgb(255_255_255/0.12)_inset,0_6px_20px_-6px_var(--accent)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_8px_28px_-6px_var(--accent)] hover:brightness-110",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[filter,background-color,box-shadow,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        variants[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} strokeWidth={2} />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { icon: LucideIcon; label: string }>(
  function IconButton({ icon: Icon, label, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={clsx(
          "inline-grid size-6 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-accent",
          className,
        )}
        {...props}
      >
        <Icon size={14} strokeWidth={2} />
      </button>
    );
  },
);

// Status

export const statusColor: Record<StatusColor, string> = {
  gray: "var(--s-gray)",
  blue: "var(--s-blue)",
  amber: "var(--s-amber)",
  green: "var(--s-green)",
  red: "var(--s-red)",
  violet: "var(--s-violet)",
};

export function StatusDot({ color, pulse }: { color: StatusColor; pulse?: boolean }) {
  return (
    <span
      className={clsx("inline-block size-2 shrink-0 rounded-full", pulse && "animate-pulse-dot")}
      style={{ background: statusColor[color], boxShadow: `0 0 0 3px color-mix(in srgb, ${statusColor[color]} 18%, transparent)` }}
    />
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] text-muted bg-raised", className)}>
      {children}
    </span>
  );
}

// Menus

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "start" }: { children: ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={4}
        className="z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-xl shadow-black/20 animate-toast-in"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  danger,
  onSelect,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={clsx(
        "flex h-7 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-hover",
        danger ? "text-danger" : "text-text",
      )}
    >
      {Icon && <Icon size={14} className={danger ? "" : "text-muted"} />}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

// Dialogs

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[22%] z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-line bg-panel p-5 shadow-2xl shadow-black/40 animate-toast-in">
          <DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className={clsx("mt-1.5 text-muted", !description && "sr-only")}>
            {description ?? title}
          </DialogPrimitive.Description>
          <div className="mt-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title={props.title} description={props.description}>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          autoFocus
          onClick={() => {
            props.onOpenChange(false);
            props.onConfirm();
          }}
        >
          {props.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

export function PromptDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  initial?: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(props.initial ?? "");
  useEffect(() => {
    if (props.open) setValue(props.initial ?? "");
  }, [props.open, props.initial]);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title={props.title} description={props.description}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await props.onSubmit(value);
            props.onOpenChange(false);
          } catch (error) {
            toast((error as Error).message, "error");
          }
        }}
      >
        <Input autoFocus value={value} placeholder={props.placeholder} onChange={(e) => setValue(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary">
            {t("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-9 w-full rounded-md border border-line bg-bg px-3 text-[13px] outline-none transition-shadow placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]",
        className,
      )}
      {...props}
    />
  );
});

// Dialogs opened from code, so they outlive the menu item that opened them.

type OpenDialog =
  | ({ kind: "prompt" } & Omit<Parameters<typeof PromptDialog>[0], "open" | "onOpenChange">)
  | ({ kind: "confirm" } & Omit<Parameters<typeof ConfirmDialog>[0], "open" | "onOpenChange">);

let openDialog: OpenDialog | null = null;
const dialogListeners = new Set<() => void>();

function showDialog(dialog: OpenDialog | null): void {
  // After the menu that asked has closed and given focus back.
  setTimeout(() => {
    openDialog = dialog;
    dialogListeners.forEach((l) => l());
  });
}

export function prompt(options: Omit<Extract<OpenDialog, { kind: "prompt" }>, "kind">): void {
  showDialog({ kind: "prompt", ...options });
}

export function confirm(options: Omit<Extract<OpenDialog, { kind: "confirm" }>, "kind">): void {
  showDialog({ kind: "confirm", ...options });
}

export function DialogHost() {
  const dialog = useSyncExternalStore(
    (l) => {
      dialogListeners.add(l);
      return () => dialogListeners.delete(l);
    },
    () => openDialog,
  );
  const [shown, setShown] = useState<OpenDialog | null>(null);
  useEffect(() => {
    if (dialog) setShown(dialog);
  }, [dialog]);
  if (!shown) return null;
  const onOpenChange = (open: boolean) => {
    if (!open) showDialog(null);
  };
  const { kind, ...props } = shown;
  return kind === "prompt" ? (
    <PromptDialog {...(props as any)} open={dialog === shown} onOpenChange={onOpenChange} />
  ) : (
    <ConfirmDialog {...(props as any)} open={dialog === shown} onOpenChange={onOpenChange} />
  );
}

// Empty states

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 grid size-11 place-items-center rounded-xl border border-line bg-raised text-muted">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="text-[15px] font-semibold">{title}</div>
        {body && <div className="mt-1 text-muted">{body}</div>}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
}

// Toasts

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let nextToast = 1;

export function toast(text: string, kind: Toast["kind"] = "info"): void {
  const item = { id: nextToast++, text, kind };
  toasts = [...toasts, item];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x !== item);
    toastListeners.forEach((l) => l());
  }, kind === "error" ? 6000 : 3500);
}

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={clsx(
            "pointer-events-auto max-w-sm rounded-lg border bg-panel px-3.5 py-2.5 text-[13px] shadow-xl shadow-black/30 animate-toast-in",
            item.kind === "error" ? "border-danger/50 text-text" : "border-line",
          )}
        >
          {item.kind === "error" && <span className="mr-2 inline-block size-1.5 rounded-full bg-danger align-middle" />}
          {item.text}
        </div>
      ))}
    </div>
  );
}

/** Runs an action and shows its error, if any, as a toast. */
export async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    toast((error as Error).message, "error");
    return undefined;
  }
}
