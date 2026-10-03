import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { ReactNode, useEffect, useRef, useState } from "react"

// Promise-based replacements for window.confirm/prompt, rendered with an
// accessible Radix alert dialog. Mount <DialogHost /> once near the app root.

interface DialogOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: "danger" | "default"
  input?: { label: string; defaultValue?: string; placeholder?: string; maxLength?: number }
}

interface PendingDialog extends DialogOptions {
  resolve: (value: string | boolean) => void
}

let enqueue: ((dialog: PendingDialog) => void) | null = null

function open(options: DialogOptions): Promise<string | boolean> {
  if (!enqueue) {
    // Host not mounted (tests or a crash screen): fall back to native dialogs.
    if (options.input) return Promise.resolve(window.prompt(options.title, options.input.defaultValue || "") ?? false)
    return Promise.resolve(window.confirm(options.title))
  }
  return new Promise((resolve) => enqueue?.({ ...options, resolve }))
}

export async function confirmDialog(options: Omit<DialogOptions, "input">): Promise<boolean> {
  return (await open(options)) === true
}

export async function promptDialog(options: DialogOptions & { input: NonNullable<DialogOptions["input"]> }): Promise<string | null> {
  const value = await open(options)
  return typeof value === "string" ? value : null
}

export function DialogHost() {
  const [queue, setQueue] = useState<PendingDialog[]>([])
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const current = queue[0]

  useEffect(() => {
    enqueue = (dialog) => setQueue((items) => [...items, dialog])
    return () => { enqueue = null }
  }, [])

  useEffect(() => {
    setValue(current?.input?.defaultValue || "")
  }, [current])

  function settle(result: string | boolean) {
    if (!current) return
    current.resolve(result)
    setQueue((items) => items.slice(1))
  }

  const confirmValue = () => settle(current?.input ? value.trim() : true)
  const disabled = Boolean(current?.input && !value.trim())

  return (
    <AlertDialog.Root open={Boolean(current)} onOpenChange={(next) => { if (!next) settle(false) }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content
          className="dialog-content"
          onOpenAutoFocus={(event) => {
            if (current?.input) {
              event.preventDefault()
              window.setTimeout(() => inputRef.current?.select(), 0)
            }
          }}
        >
          {current && (
            <form onSubmit={(event) => { event.preventDefault(); if (!disabled) confirmValue() }}>
              <AlertDialog.Title className="dialog-title">{current.title}</AlertDialog.Title>
              {current.description ? (
                <AlertDialog.Description className="dialog-description">{current.description}</AlertDialog.Description>
              ) : (
                <AlertDialog.Description className="sr-only">{current.title}</AlertDialog.Description>
              )}
              {current.input && (
                <label className="field dialog-field">
                  <span className="field-label">{current.input.label}</span>
                  <input
                    ref={inputRef}
                    className="field-input"
                    value={value}
                    maxLength={current.input.maxLength || 120}
                    placeholder={current.input.placeholder}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
              )}
              <div className="dialog-actions">
                <AlertDialog.Cancel asChild>
                  <button type="button" className="btn-ghost">{current.cancelLabel || "Cancel"}</button>
                </AlertDialog.Cancel>
                <button type="submit" className={current.tone === "danger" ? "btn-danger" : "btn-primary"} disabled={disabled}>
                  {current.confirmLabel || "Continue"}
                </button>
              </div>
            </form>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
