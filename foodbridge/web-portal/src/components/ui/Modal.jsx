import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md", className = "" }) {
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`w-full ${maxWidth} bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-warm-lg)] overflow-hidden transition-all transform animate-scaleUp ${className}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
