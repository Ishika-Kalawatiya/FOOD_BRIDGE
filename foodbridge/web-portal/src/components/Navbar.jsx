import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Compass,
  Flame,
  HeartHandshake,
  Home,
  Layers,
  LogOut,
  MapPin,
  Moon,
  RefreshCw,
  Sun,
  Truck,
  User,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";
import { NotificationBell } from "./NotificationBell";

const navigation = [
  { to: "/", label: "Home", icon: Home },
  { to: "/#live-surplus", label: "Live Rescues", icon: MapPin },
  { to: "/#how-it-works", label: "How It Works", icon: Compass },
  { to: "/#roles", label: "Portals", icon: Layers },
  { to: "/donate", label: "Donate Food", icon: HeartHandshake },
  { to: "/courier", label: "Delivery Partner", icon: Truck },
  { to: "/ngo", label: "NGO Shelter Hub", icon: Building2 },
  { to: "/impact", label: "Impact & Audits", icon: BarChart3 },
  { to: "/#light-your-lantern", label: "Light Your Lantern", icon: Flame },
];

const roles = [
  { key: "donor", label: "Donor / Canteen", desc: "List surplus food" },
  { key: "volunteer", label: "Volunteer", desc: "Rescue and deliver meals" },
  { key: "ngo", label: "NGO / Shelter", desc: "Confirm meal distribution" },
];

export function Navbar({
  currentUser,
  activeRole,
  onSelectRole,
  onOpenAuth,
  onLogout,
  onRefresh,
  activeListingsCount = 0,
  isDemoMode = false,
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("fb_theme") === "dark" ? "dark" : "light";
    } catch (_e) {
      return "light";
    }
  });
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("fb_theme", theme);
    } catch (_e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  const selectRole = (role) => {
    onSelectRole(role);
    setProfileMenuOpen(false);
  };

  const startSignIn = () => {
    setProfileMenuOpen(false);
    onOpenAuth({ role: activeRole });
  };

  return (
    <header className={`foodbridge-navbar sticky top-0 z-40 bg-[var(--color-bg-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] shadow-[var(--shadow-warm-sm)] transition-all${isLanding ? " foodbridge-navbar--landing" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[72px] flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="FoodBridge Homepage">
          <Logo className="w-10 h-10" showText />
          <span className="foodbridge-brand-live-dot" aria-hidden="true" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {isLanding && (
            <span className="foodbridge-navbar__activity hidden md:inline-flex">
              <i /> {activeListingsCount} Active Rescues Near You
            </span>
          )}
          {isDemoMode && (
            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Demo Mode
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh listings"
              aria-label="Refresh listings"
              className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)] hover:bg-[var(--color-bg-subtle)] border border-[var(--color-border)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {currentUser && <NotificationBell />}

          <Button
            size="sm"
            variant="secondary"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            className="font-bold gap-1.5"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[var(--color-leaf-green)]" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </Button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label={currentUser ? `Open profile and navigation for ${currentUser.name}` : "Open profile and navigation"}
              aria-expanded={profileMenuOpen}
              aria-controls="foodbridge-profile-menu"
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2.5 py-2 text-[var(--color-forest-text)] hover:bg-[var(--color-bg-subtle)]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)]">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden md:block max-w-28 truncate text-xs font-bold">
                {currentUser?.name || "Profile"}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {profileMenuOpen && (
              <div
                id="foodbridge-profile-menu"
                className="absolute right-0 mt-2 w-[min(90vw,340px)] max-h-[min(75vh,620px)] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2 shadow-[var(--shadow-warm-lg)]"
              >
                {currentUser && (
                  <div className="border-b border-[var(--color-border)] px-3 py-2.5">
                    <p className="truncate text-sm font-bold text-[var(--color-forest-text)]">{currentUser.name}</p>
                    <p className="text-xs capitalize text-[var(--color-text-muted)]">
                      {currentUser.role === "volunteer" ? "Volunteer" : currentUser.role}
                      {currentUser.org ? ` · ${currentUser.org}` : ""}
                    </p>
                  </div>
                )}
                <div className="py-1" aria-label="Site navigation">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => {
                          setProfileMenuOpen(false);
                          if (isLanding && item.to.startsWith("/#")) {
                            document.querySelector(item.to.slice(1))?.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-forest-text)] hover:bg-[var(--color-bg-subtle)]"
                      >
                        {Icon ? <Icon className="h-4 w-4 text-[var(--color-leaf-green)]" /> : <span className="h-4 w-4" />}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="border-t border-[var(--color-border)] py-2">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Active role
                  </p>
                  {roles.map((role) => (
                    <button
                      type="button"
                      key={role.key}
                      onClick={() => selectRole(role.key)}
                      aria-pressed={activeRole === role.key}
                      className={`flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-[var(--color-bg-subtle)] ${
                        activeRole === role.key ? "bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)]" : "text-[var(--color-forest-text)]"
                      }`}
                    >
                      <span className="text-xs font-bold">{role.label}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{role.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-[var(--color-border)] pt-2">
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                        navigate("/");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startSignIn}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[var(--color-leaf-green)] hover:bg-[var(--color-bg-subtle)]"
                    >
                      <User className="h-4 w-4" /> Sign in
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
