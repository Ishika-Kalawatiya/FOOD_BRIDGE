import React, { useState } from "react";
import { Mail, Lock, User, Building, ShieldCheck, Sparkles, KeyRound } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input, Select } from "./ui/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import { apiCall } from "../services/api";

export function AuthModal({ isOpen, onClose, options = {} }) {
  const { login } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("quick"); // "quick" | "custom"

  // Quick Demo Accounts
  const demoAccounts = [
    {
      name: "Campus Canteen Manager",
      role: "donor",
      org: "Green Valley Dining Hall",
      id: 1,
    },
    {
      name: "Courier Alex",
      role: "volunteer",
      org: "Swift Rescue Network",
      id: 2,
    },
    {
      name: "Hope Shelter Staff",
      role: "ngo",
      org: "Hope Community Shelter",
      id: 3,
    },
  ];

  // Form states
  const [name, setName] = useState("");
  const [role, setRole] = useState("donor");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (options.role) {
        setRole(options.role);
      }
      if (options.tab) {
        setTab(options.tab);
      }
    }
  }, [isOpen, options]);

  async function handleQuickSelect(acc) {
    try {
      setLoading(true);
      await login(acc);
      toast.success(`Welcome back, ${acc.name}! Active as ${acc.role.toUpperCase()}.`);
      onClose();
      if (options.onLoginSuccess) {
        try {
          await options.onLoginSuccess(acc);
        } catch (_e) {}
      }
    } catch (err) {
      toast.error(err.message || "Failed to switch account");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    try {
      setLoading(true);
      const user = await apiCall("/api/users/login", {
        method: "POST",
        body: { name: name.trim(), role, org: org.trim() || undefined },
      });
      const creds = {
        id: user.id || Date.now(),
        name: user.name || name.trim(),
        role: user.role || role,
        org: user.org || org.trim() || `${name}'s Org`,
      };
      await login(creds);
      toast.success(`Authenticated successfully as ${name}!`);
      onClose();
      if (options.onLoginSuccess) {
        try {
          await options.onLoginSuccess(creds);
        } catch (_e) {}
      }
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="FoodBridge Authentication" maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setTab("quick")}
            className={`py-1.5 text-xs font-bold font-['Quicksand'] rounded-[var(--radius-sm)] transition-all ${
              tab === "quick"
                ? "bg-[var(--color-bg-surface)] text-[var(--color-leaf-green)] shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)]"
            }`}
          >
            One-Click Profiles
          </button>
          <button
            type="button"
            onClick={() => setTab("custom")}
            className={`py-1.5 text-xs font-bold font-['Quicksand'] rounded-[var(--radius-sm)] transition-all ${
              tab === "custom"
                ? "bg-[var(--color-bg-surface)] text-[var(--color-leaf-green)] shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)]"
            }`}
          >
            Custom Sign In
          </button>
        </div>

        {tab === "quick" ? (
          <div className="space-y-2.5 pt-1">
            <p className="text-xs text-[var(--color-text-muted)]">
              Choose a pre-configured role to immediately test real donor listings, volunteer pickups, and shelter receipts:
            </p>
            {demoAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleQuickSelect(acc)}
                disabled={loading}
                className="w-full p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-leaf-green)] transition-all text-left flex items-center justify-between group shadow-xs"
              >
                <div>
                  <div className="text-sm font-bold font-['Quicksand'] text-[var(--color-forest-text)] group-hover:text-[var(--color-leaf-green)]">
                    {acc.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {acc.org} &bull; <span className="capitalize font-semibold text-[var(--color-leaf-green)]">{acc.role}</span>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full text-[11px] font-bold bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)]">
                  Use Role
                </div>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <Input
              label="Your Full Name"
              placeholder="e.g. Maria Gonzalez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="donor">Food Donor (Canteen / Restaurant / Hostel)</option>
              <option value="volunteer">Volunteer Courier (Pickup & Deliver)</option>
              <option value="ngo">NGO Shelter Hub (Recipient Kitchen)</option>
            </Select>
            <Input
              label="Organization / Affiliation"
              placeholder="e.g. North Dining Hall / Green Wheels"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />
            <Button type="submit" variant="primary" loading={loading} className="w-full mt-2">
              Sign In to FoodBridge
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
