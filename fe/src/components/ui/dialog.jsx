import * as React from "react"
import { cn } from "@/lib/utils"

function Dialog({ open, onOpenChange, children, className, ...props }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && onOpenChange) {
          onOpenChange(false)
        }
      }}
      {...props}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Dialog Content */}
      <div
        className={cn(
          "relative z-50 w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function DialogContent({ className, children, ...props }) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }) {
  return (
    <div className={cn("mb-4", className)} {...props} />
  )
}

function DialogTitle({ className, ...props }) {
  return (
    <h2
      className={cn("text-2xl font-semibold text-gray-900 dark:text-gray-100", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-gray-600 dark:text-gray-400 mt-2", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }) {
  return (
    <div className={cn("flex justify-end gap-3 mt-6", className)} {...props} />
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}

