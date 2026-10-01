import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as RadixPopover from "@radix-ui/react-popover"
import { Check } from "lucide-react"
import { ComponentPropsWithoutRef, ReactNode, forwardRef } from "react"

// Thin, styled wrappers around Radix primitives. Radix handles focus
// management, keyboard navigation, collision-aware positioning, and Escape.

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group
export const MenuRadioGroup = DropdownMenu.RadioGroup

export const MenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DropdownMenu.Content>>(
  function MenuContent({ className = "", sideOffset = 6, align = "start", ...props }, ref) {
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.Content ref={ref} sideOffset={sideOffset} align={align} collisionPadding={12} className={`menu-content ${className}`} {...props} />
      </DropdownMenu.Portal>
    )
  },
)

export function MenuItem({ icon, children, hint, tone, className = "", ...props }: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { icon?: ReactNode; hint?: ReactNode; tone?: "danger" }) {
  return (
    <DropdownMenu.Item className={`menu-item${tone === "danger" ? " danger" : ""} ${className}`} {...props}>
      {icon && <span className="menu-icon" aria-hidden="true">{icon}</span>}
      <span className="menu-text">{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </DropdownMenu.Item>
  )
}

export function MenuRadioItem({ children, hint, className = "", ...props }: ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem> & { hint?: ReactNode }) {
  return (
    <DropdownMenu.RadioItem className={`menu-item ${className}`} {...props}>
      <span className="menu-icon" aria-hidden="true">
        <DropdownMenu.ItemIndicator><Check size={15} /></DropdownMenu.ItemIndicator>
      </span>
      <span className="menu-text">{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </DropdownMenu.RadioItem>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="menu-label">{children}</DropdownMenu.Label>
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="menu-separator" />
}

export const Popover = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverClose = RadixPopover.Close

export const PopoverContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixPopover.Content>>(
  function PopoverContent({ className = "", sideOffset = 6, align = "start", ...props }, ref) {
    return (
      <RadixPopover.Portal>
        <RadixPopover.Content ref={ref} sideOffset={sideOffset} align={align} collisionPadding={12} className={`popover-content ${className}`} {...props} />
      </RadixPopover.Portal>
    )
  },
)
