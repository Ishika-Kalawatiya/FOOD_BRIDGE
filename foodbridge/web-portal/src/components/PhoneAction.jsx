import React from "react";
import { Phone } from "lucide-react";
import { useToast } from "./ui/Toast";

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|IEMobile|Windows Phone/i.test(navigator.userAgent);
}

export function PhoneAction({ label, phone, compact = false }) {
  const toast = useToast();
  if (!phone) return null;

  const number = String(phone);
  const telNumber = number.replace(/[^\d+]/g, "");

  const handleClick = async (event) => {
    if (isMobileDevice()) return;
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(number);
      toast.success(`${label} number copied: ${number}`);
    } catch {
      toast.info(`${label}: ${number}`);
    }
  };

  return (
    <a
      href={`tel:${telNumber}`}
      onClick={handleClick}
      className={`phone-action${compact ? " phone-action--compact" : ""}`}
      aria-label={`${label}: ${number}`}
      title={`Call ${label}`}
    >
      <Phone className="w-4 h-4" />
      <span>{label}</span>
    </a>
  );
}
