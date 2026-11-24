import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HeartHandshake,
  Truck,
  Building2,
  Sparkles,
  ArrowRight,
  Utensils,
  Leaf,
  Scale,
  Award,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ExpiryBadge } from "../components/ui/ExpiryBadge";
import { useAuth } from "../context/AuthContext";

export function LandingView({ totalDivertedMeals = 120, activeListingsCount = 3 }) {
  const { setActiveRole, openAuthModal } = useAuth();
  const navigate = useNavigate();

  // Interactive Live Simulator state
  const [simStep, setSimStep] = useState(1);
  const [simRole, setSimRole] = useState("donor");

  const simStepsData = {
    1: {
      role: "donor",
      status: "Available for Rescue",
      badgeVariant: "leaf",
      title: "50 Servings Fresh Veg Curry & Rice",
      meta: "📍 Campus Central Canteen • ⌛ Safe for ~2h 15m",
      progress: 33,
      desc: "Campus canteen finishes lunch service with 50 safe, untouched meals. Donor creates a surplus listing with thermal storage verification.",
      actionText: "Advance to Courier Pickup ➔",
      portalRole: "donor",
      portalLabel: "Open Donor Hub",
      portalPath: "/donate",
    },
    2: {
      role: "volunteer",
      status: "Claimed • Courier En Route",
      badgeVariant: "warning",
      title: "50 Servings Fresh Veg Curry & Rice",
      meta: "🚴 Courier Alex assigned • Pickup from Gate 3",
      progress: 66,
      desc: "Nearby student courier receives live dispatch alert on bicycle. Courier arrives at canteen loading dock and scans receipt confirmation.",
      actionText: "Advance to Shelter Delivery ➔",
      portalRole: "volunteer",
      portalLabel: "Open Courier Board",
      portalPath: "/courier",
    },
    3: {
      role: "ngo",
      status: "Delivered • Distributed to Community",
      badgeVariant: "success",
      title: "50 Servings Fresh Veg Curry & Rice",
      meta: "🏢 Hope Community Shelter • Verified distributed",
      progress: 100,
      desc: "Meals delivered warm to shelter dining kitchen. Distribution logged to public audit trail; 20kg food waste & 50kg CO2e avoided.",
      actionText: "Restart Rescue Simulation ↺",
      portalRole: "ngo",
      portalLabel: "Open NGO Shelter Hub",
      portalPath: "/ngo",
    },
  };

  const currentSim = simStepsData[simStep];

  function handleNextSimStep() {
    if (simStep === 3) setSimStep(1);
    else setSimStep((prev) => prev + 1);
  }

  function handleSwitchSimRole(roleKey) {
    setSimRole(roleKey);
    if (roleKey === "donor") setSimStep(1);
    if (roleKey === "volunteer") setSimStep(2);
    if (roleKey === "ngo") setSimStep(3);
  }

  return (
    <div className="space-y-16 lg:space-y-24 pb-16">
      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section id="home" className="pt-8 sm:pt-14 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] border border-[var(--color-leaf-green)]/20 text-xs font-bold font-['Quicksand']">
              <span className="w-2 h-2 rounded-full bg-[var(--color-leaf-green)] animate-pulse" />
              <span>Campus Food Rescue &amp; SDG 2/12 Initiative</span>
            </div>

            <h1 className="font-['Fraunces'] text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--color-forest-text)] leading-[1.15]">
              Every meal saved is a{" "}
              <span className="text-[var(--color-leaf-green)] underline decoration-[var(--color-mustard)] decoration-wavy decoration-2">
                bridge built.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--color-text-muted)] font-['Inter'] leading-relaxed max-w-2xl">
              FoodBridge connects edible surplus from campus canteens, dining halls, and restaurants directly to local student volunteers and community shelters before safety windows lapse.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/donate">
                <Button variant="primary" size="lg">
                  <HeartHandshake className="w-5 h-5" />
                  <span>Donate Surplus Food</span>
                </Button>
              </Link>

              <Link to="/courier">
                <Button variant="mango" size="lg">
                  <Truck className="w-5 h-5" />
                  <span>Volunteer as Courier</span>
                </Button>
              </Link>

              <Link to="/portal">
                <Button variant="secondary" size="lg">
                  <span>Explore Role Portal ➔</span>
                </Button>
              </Link>
            </div>

            {/* Live Counter Strip */}
            <div className="pt-6 border-t border-[var(--color-border)] grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-[var(--color-leaf-green)]">
                  {totalDivertedMeals.toLocaleString()}+
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Meals Rescued</div>
              </div>
              <div className="border-l border-[var(--color-border)] pl-4">
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-[var(--color-tomato-orange)]">
                  {Math.round(totalDivertedMeals * 0.40)}kg
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Waste Diverted</div>
              </div>
              <div className="border-l border-[var(--color-border)] pl-4">
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-amber-700">
                  {activeListingsCount}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Active Safe Batches</div>
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Workflow Simulation Card */}
          <div className="lg:col-span-5">
            <Card className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-border)] shadow-[var(--shadow-warm-lg)] p-6">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-1.5 text-xs font-bold font-['Quicksand'] text-[var(--color-leaf-green)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-leaf-green)] animate-ping" />
                  <span>LIVE RESCUE SIMULATION</span>
                </div>
                <Badge variant="neutral">Step {simStep} of 3</Badge>
              </div>

              {/* Role Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] mb-4 text-xs font-bold font-['Quicksand']">
                <button
                  type="button"
                  onClick={() => handleSwitchSimRole("donor")}
                  className={`py-1.5 rounded-[var(--radius-sm)] transition-all ${
                    currentSim.role === "donor"
                      ? "bg-[var(--color-bg-surface)] text-[var(--color-leaf-green)] shadow-xs"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  👨‍🍳 Donor
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchSimRole("volunteer")}
                  className={`py-1.5 rounded-[var(--radius-sm)] transition-all ${
                    currentSim.role === "volunteer"
                      ? "bg-[var(--color-bg-surface)] text-[var(--color-leaf-green)] shadow-xs"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  🚴 Courier
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchSimRole("ngo")}
                  className={`py-1.5 rounded-[var(--radius-sm)] transition-all ${
                    currentSim.role === "ngo"
                      ? "bg-[var(--color-bg-surface)] text-[var(--color-leaf-green)] shadow-xs"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  🏢 Shelter
                </button>
              </div>

              {/* Simulation Content Body */}
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]/70 border border-[var(--color-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={currentSim.badgeVariant}>{currentSim.status}</Badge>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono">Stage {simStep}/3</span>
                </div>

                <h4 className="font-['Fraunces'] text-base font-bold text-[var(--color-forest-text)]">
                  {currentSim.title}
                </h4>

                <p className="text-xs text-[var(--color-text-muted)]">{currentSim.meta}</p>

                {/* Progress Track */}
                <div className="w-full bg-[var(--color-border)] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[var(--color-leaf-green)] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${currentSim.progress}%` }}
                  />
                </div>

                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed pt-1">
                  {currentSim.desc}
                </p>
              </div>

              {/* Simulation Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNextSimStep}
                  className="flex-1 font-bold"
                >
                  {currentSim.actionText}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setActiveRole(currentSim.portalRole);
                    navigate(currentSim.portalPath);
                  }}
                  className="flex-1 font-bold"
                >
                  {currentSim.portalLabel} ➔
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE PROBLEM SECTION (#problem)
          ========================================================================= */}
      <section id="problem" className="py-12 bg-[var(--color-bg-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold font-['Quicksand'] text-[var(--color-tomato-orange)] uppercase tracking-wider">
              The Real-World Challenge
            </span>
            <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-1.5">
              The Campus Surplus Paradox
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              Large quantities of perfectly cooked, untouched meals are discarded daily while neighboring families and students struggle with hunger.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[var(--color-bg-subtle)]/50 border-[var(--color-border)] p-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-tomato-alpha)] text-[var(--color-tomato-dark)] flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-tomato-dark)]">
                The Logistics Barrier
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Campus canteens and hostel dining halls finish service with 30-100 portions of fresh food. Without real-time communication tools, notifying local shelters and organizing timely transportation before safety countdowns expire has historically been nearly impossible.
              </p>
            </Card>

            <Card className="bg-[var(--color-bg-subtle)]/50 border-[var(--color-border)] p-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] flex items-center justify-center font-bold">
                <Leaf className="w-5 h-5" />
              </div>
              <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-leaf-green)]">
                The Ecological &amp; Carbon Cost
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                When organic food decays in municipal landfills, it produces potent methane gas—up to 28 times more harmful than carbon dioxide. Every single kilogram of rescued food prevents 2.5kg of greenhouse gas emissions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS SECTION (#how-it-works)
          ========================================================================= */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold font-['Quicksand'] text-[var(--color-leaf-green)] uppercase tracking-wider">
            Verified Pipeline
          </span>
          <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-1.5">
            How FoodBridge Works
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            A verified 4-stage rescue loop linking food donors, student couriers, and shelter kitchens.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-[var(--color-leaf-green)] text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                1
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                Post Surplus
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Donors list surplus portions with pickup address, packaging details, and safe expiry window.
              </p>
            </div>
            <Link to="/donate" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>Post Food ➔</span>
              </Button>
            </Link>
          </Card>

          {/* Step 2 */}
          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-[var(--color-mustard-dark)] text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                2
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                Claim Pickup
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Volunteer student couriers view the live board and claim urgent nearby pickups before expiry.
              </p>
            </div>
            <Link to="/courier" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>Accept Pickup ➔</span>
              </Button>
            </Link>
          </Card>

          {/* Step 3 */}
          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-purple-700 text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                3
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                Transport &amp; Distribute
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Courier collects meals and delivers them to verified community shelters and homeless kitchens.
              </p>
            </div>
            <Link to="/ngo" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>Shelter Hub ➔</span>
              </Button>
            </Link>
          </Card>

          {/* Step 4 */}
          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-emerald-800 text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                4
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                Verify Impact
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Shelter confirms receipt. Delivery logged onto public audit ledger and monthly environmental metrics.
              </p>
            </div>
            <Link to="/impact" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>View Analytics ➔</span>
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          FOUR OPERATIONAL PATHWAYS SECTION
          ========================================================================= */}
      <section className="py-12 bg-[var(--color-bg-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold font-['Quicksand'] text-[var(--color-leaf-green)] uppercase tracking-wider">
              Take Direct Action
            </span>
            <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-1.5">
              Three Core Roles, One United Platform
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              Select your role pathway to start rescuing surplus food right away.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pathway 1: Donors */}
            <Card hoverable className="p-6 border-t-4 border-t-[var(--color-leaf-green)] flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] flex items-center justify-center text-xl mb-4 font-bold">
                  👨‍🍳
                </div>
                <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)] mb-2">
                  Food Donors &amp; Canteens
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
                  For university cafeterias, hostel mess halls, bakeries, and catered event organizers with fresh surplus ready for dispatch.
                </p>
              </div>
              <Link to="/donate">
                <Button variant="primary" className="w-full">
                  <span>Enter Donor Hub ➔</span>
                </Button>
              </Link>
            </Card>

            {/* Pathway 2: Volunteers */}
            <Card hoverable className="p-6 border-t-4 border-t-[var(--color-mustard)] flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-[var(--color-mustard-alpha)] text-[var(--color-mustard-dark)] flex items-center justify-center text-xl mb-4 font-bold">
                  🚴
                </div>
                <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)] mb-2">
                  Volunteer Couriers
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
                  For students and community volunteers on foot, bicycle, or scooter ready to bridge campus pickups to local redistribution shelters.
                </p>
              </div>
              <Link to="/courier">
                <Button variant="mango" className="w-full">
                  <span>Open Courier Board ➔</span>
                </Button>
              </Link>
            </Card>

            {/* Pathway 3: NGOs */}
            <Card hoverable className="p-6 border-t-4 border-t-purple-700 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl mb-4 font-bold">
                  🏢
                </div>
                <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)] mb-2">
                  Shelter Hubs &amp; NGOs
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
                  For verified community kitchens, shelters, and non-profits receiving food batches and serving vulnerable residents.
                </p>
              </div>
              <Link to="/ngo">
                <Button variant="secondary" className="w-full">
                  <span>Enter Shelter Hub ➔</span>
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* =========================================================================
          IMPACT SUMMARY SECTION (#impact)
          ========================================================================= */}
      <section id="impact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Card className="bg-[var(--color-bg-surface)] border-[var(--color-border)] p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--color-border)]">
            <div>
              <span className="text-xs font-bold font-['Quicksand'] text-[var(--color-leaf-green)] uppercase tracking-wider">
                Verifiable Results
              </span>
              <h2 className="font-['Fraunces'] text-3xl font-extrabold text-[var(--color-forest-text)] mt-1">
                Real Community Impact
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Every delivery is logged and verified with quantitative SDG metrics.
              </p>
            </div>
            <Link to="/impact">
              <Button variant="primary">
                <span>View Full Audit &amp; Monthly Reports ➔</span>
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]/70">
              <div className="text-xs font-bold font-['Quicksand'] uppercase text-[var(--color-text-muted)] mb-1">
                Meals Diverted
              </div>
              <div className="font-['Fraunces'] text-4xl font-extrabold text-[var(--color-leaf-green)]">
                {totalDivertedMeals}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Nourishing meals served</div>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]/70">
              <div className="text-xs font-bold font-['Quicksand'] uppercase text-[var(--color-text-muted)] mb-1">
                Organic Waste Saved
              </div>
              <div className="font-['Fraunces'] text-4xl font-extrabold text-[var(--color-tomato-orange)]">
                {Math.round(totalDivertedMeals * 0.40)}kg
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Prevented from entering dumps</div>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]/70">
              <div className="text-xs font-bold font-['Quicksand'] uppercase text-[var(--color-text-muted)] mb-1">
                CO2e Emissions Prevented
              </div>
              <div className="font-['Fraunces'] text-4xl font-extrabold text-emerald-800">
                {Math.round(totalDivertedMeals * 0.40 * 2.50)}kg
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Greenhouse gas offset</div>
            </div>
          </div>
        </Card>
      </section>

      {/* =========================================================================
          GET INVOLVED SECTION (#get-involved)
          ========================================================================= */}
      <section id="get-involved" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-leaf-green)] text-white p-8 sm:p-12 text-center relative overflow-hidden shadow-[var(--shadow-warm-lg)]">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold leading-tight">
              Ready to turn campus food waste into zero hunger?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100 font-['Inter'] leading-relaxed">
              Join dozens of student volunteers, campus dining managers, and shelter kitchens making food rescue a daily reality.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="mango"
                size="lg"
                onClick={openAuthModal}
              >
                <span>Join the Rescue Network ➔</span>
              </Button>
              <Link to="/portal">
                <Button
                  variant="secondary"
                  size="lg"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                >
                  <span>Launch Unified Portal</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
