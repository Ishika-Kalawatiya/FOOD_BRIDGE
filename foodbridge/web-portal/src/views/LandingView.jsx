import React, { useState } from "react";
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
  Compass,
  MapPin,
  Calendar,
  Send,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";

export function LandingView({ totalDivertedMeals = 120, activeListingsCount = 3 }) {
  const { setActiveRole, openAuthModal } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Interactive Live Simulator state
  const [simStep, setSimStep] = useState(1);
  const [simRole, setSimRole] = useState("donor");

  // Impact Calculator Slider state
  const [dailyMealsSlider, setDailyMealsSlider] = useState(250);

  // Rescue Drive Signup Form state
  const [regName, setRegName] = useState("");
  const [regOrg, setRegOrg] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState("volunteer");
  const [regSubmitted, setRegSubmitted] = useState(false);

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
      portalLabel: "Execute Donor Posting",
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
      portalLabel: "Accept Pickup Claim",
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
      portalLabel: "Confirm Shelter Receipt",
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

  function handleDriveSignup(e) {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      toast.error("Please provide your name and email address.");
      return;
    }
    setRegSubmitted(true);
    toast.success(`🎉 Thank you for registering, ${regName}! Check your email for drive details.`);
  }

  // Calculated Calculator Metrics
  const monthlyMeals = dailyMealsSlider * 30;
  const monthlyWasteKg = Math.round(monthlyMeals * 0.40);
  const monthlyCo2Kg = Math.round(monthlyWasteKg * 2.50);
  const monthlyPoints = monthlyMeals * 15;

  return (
    <div className="space-y-16 lg:space-y-24 pb-16 font-['Inter']">
      {/* =========================================================================
          SECTION 1: HERO SECTION (#home)
          ========================================================================= */}
      <section id="home" className="pt-8 sm:pt-14 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-['Fraunces'] text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--color-forest-text)] leading-[1.15]">
              Every meal saved is a{" "}
              <span className="text-[var(--color-leaf-green)] underline decoration-[var(--color-mustard)] decoration-wavy decoration-2">
                bridge built.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--color-text-muted)] font-['Inter'] leading-relaxed max-w-2xl">
              FoodBridge connects surplus food from canteens, restaurants, and events directly to communities facing food insecurity.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/portal">
                <Button variant="primary" size="lg">
                  <span>🚀 Launch Rescue Portal ➔</span>
                </Button>
              </Link>

              <Button
                variant="mango"
                size="lg"
                onClick={openAuthModal}
              >
                <span>👤 View My Profile</span>
              </Button>
            </div>

            {/* Live Counter Strip */}
            <div className="pt-6 border-t border-[var(--color-border)] grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-[var(--color-leaf-green)]">
                  {totalDivertedMeals.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Meals Rescued</div>
              </div>
              <div className="border-l border-[var(--color-border)] pl-4">
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-[var(--color-tomato-orange)]">
                  {Math.round(totalDivertedMeals * 0.40)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Food Waste Avoided (kg)</div>
              </div>
              <div className="border-l border-[var(--color-border)] pl-4">
                <div className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-amber-700">
                  480+
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium">Active Volunteers</div>
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Workflow Simulation Card */}
          <div className="lg:col-span-5">
            <Card className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-border)] shadow-[var(--shadow-warm-lg)] p-6">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-1.5 text-xs font-bold font-['Quicksand'] text-[var(--color-leaf-green)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-leaf-green)] animate-ping" />
                  <span>LIVE WORKFLOW SIMULATION</span>
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
                  🏢 NGO
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
          SECTION 2: THE PROBLEM (#problem)
          ========================================================================= */}
      <section id="problem" className="py-12 bg-[var(--color-bg-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold font-['Quicksand'] bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] uppercase tracking-wider">
              The Challenge
            </span>
            <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-2">
              What&apos;s Going On?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[var(--color-bg-subtle)]/50 border-[var(--color-border)] p-6 space-y-3">
              <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-tomato-dark)]">
                The Surplus Paradox
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                Food wastage is a significant social and environmental issue. Large quantities of edible surplus food from college canteens, restaurants, hotels, households, and events are often discarded because there is no timely mechanism to connect that food with people or organizations that can use it. At the same time, many communities face food insecurity and limited access to adequate meals.
              </p>
            </Card>

            <Card className="bg-[var(--color-bg-subtle)]/50 border-[var(--color-border)] p-6 space-y-3">
              <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-leaf-green)]">
                The Awareness Gap
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                While food donation and redistribution initiatives exist, young people often have limited awareness or active participation in food-rescue activities. Traditional awareness campaigns may communicate the problem but do not necessarily make people understand the practical challenges involved in rescuing food, such as limited time, food expiry, transportation constraints, and choosing efficient delivery routes.
              </p>
            </Card>
          </div>

          {/* 4 Challenge Keyword Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <Card hoverable className="p-4 text-center space-y-2 border-[var(--color-border)]">
              <div className="text-3xl">⏱️</div>
              <h4 className="font-['Quicksand'] text-sm font-bold text-[var(--color-forest-text)]">Limited Time</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Surplus meals must be collected immediately post-event before window closes.</p>
            </Card>

            <Card hoverable className="p-4 text-center space-y-2 border-[var(--color-border)]">
              <div className="text-3xl">⏳</div>
              <h4 className="font-['Quicksand'] text-sm font-bold text-[var(--color-forest-text)]">Food Expiry</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Perishable items lose safety rapidly without temperature-controlled transport.</p>
            </Card>

            <Card hoverable className="p-4 text-center space-y-2 border-[var(--color-border)]">
              <div className="text-3xl">🚛</div>
              <h4 className="font-['Quicksand'] text-sm font-bold text-[var(--color-forest-text)]">Transportation</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Mobilizing volunteers and vehicles on short notice presents logistical hurdles.</p>
            </Card>

            <Card hoverable className="p-4 text-center space-y-2 border-[var(--color-border)]">
              <div className="text-3xl">🗺️</div>
              <h4 className="font-['Quicksand'] text-sm font-bold text-[var(--color-forest-text)]">Efficient Routes</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Mapping optimal delivery paths to community centers saves crucial minutes.</p>
            </Card>
          </div>

          {/* Surplus Sources Identified Chips */}
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold font-['Quicksand'] uppercase tracking-wider text-[var(--color-forest-text)]">
              Key Surplus Sources Identified:
            </span>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-border)] shadow-xs">
                🏫 College Canteens
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-border)] shadow-xs">
                🍽️ Restaurants
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-border)] shadow-xs">
                🏨 Hotels
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-border)] shadow-xs">
                🏡 Households
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-border)] shadow-xs">
                🎉 Events &amp; Festivities
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: WHAT FOODBRIDGE DOES & PROJECT AIMS (#solution)
          ========================================================================= */}
      <section id="solution" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="p-8 rounded-[var(--radius-xl)] bg-[var(--color-leaf-green-alpha)] border border-[var(--color-leaf-green)]/30 space-y-2 text-center max-w-4xl mx-auto">
          <h3 className="font-['Fraunces'] text-2xl font-bold text-[var(--color-leaf-green)]">
            What FoodBridge Does
          </h3>
          <p className="text-sm text-[var(--color-forest-text)] leading-relaxed max-w-3xl mx-auto">
            FoodBridge connects surplus food sources with local student volunteers and community redistribution centers. Volunteers receive real-time notifications for nearby food surplus pickups, coordinate transportation, and deliver meals before food expiry timers run out.
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold font-['Quicksand'] bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
              Core Objectives
            </span>
            <h2 className="font-['Fraunces'] text-3xl font-extrabold text-[var(--color-forest-text)] mt-2">
              Project Aims
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">
              Empowering students through awareness and tangible community action.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { num: "01", text: "Increase awareness of food wastage among students." },
              { num: "02", text: "Teach the importance of timely food rescue and redistribution." },
              { num: "03", text: "Make sustainability education practical and accessible." },
              { num: "04", text: "Encourage direct participation in community food drives." },
              { num: "05", text: "Demonstrate measurable outcomes through platform analytics." },
            ].map((aim) => (
              <Card key={aim.num} hoverable className="p-5 border-[var(--color-border)] space-y-2">
                <span className="font-['Fraunces'] text-2xl font-bold text-[var(--color-leaf-green)]">{aim.num}</span>
                <p className="text-xs text-[var(--color-text-muted)] font-medium leading-snug">{aim.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: HOW IT WORKS (#how-it-works)
          ========================================================================= */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="px-3 py-1 rounded-full text-xs font-bold font-['Quicksand'] bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] uppercase tracking-wider">
            Rescue Workflow
          </span>
          <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-2">
            How It Works
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            From surplus notification to real-world community impact in four simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-[var(--color-leaf-green)] text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                1
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                1. Post
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Canteens, restaurants, and households post surplus food listings with expiry windows.
              </p>
            </div>
            <Link to="/donate" className="pt-4">
              <Button size="sm" variant="primary" className="w-full">
                <span>👨‍🍳 Post Food ➔</span>
              </Button>
            </Link>
          </Card>

          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-[var(--color-mustard-dark)] text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                2
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                2. Claim
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Student volunteer couriers claim urgent rescue pickups on the platform map.
              </p>
            </div>
            <Link to="/courier" className="pt-4">
              <Button size="sm" variant="mango" className="w-full">
                <span>🚴 Accept Pickup ➔</span>
              </Button>
            </Link>
          </Card>

          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-purple-700 text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                3
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                3. Deliver
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Pick efficient delivery routes to transport fresh food directly to community centers.
              </p>
            </div>
            <Link to="/ngo" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>🏢 NGO Shelter Hub ➔</span>
              </Button>
            </Link>
          </Card>

          <Card hoverable className="p-5 flex flex-col justify-between border-[var(--color-border)]">
            <div>
              <div className="w-9 h-9 rounded-full bg-emerald-800 text-white font-['Fraunces'] font-bold flex items-center justify-center text-sm mb-3">
                4
              </div>
              <h3 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)] mb-1">
                4. Impact
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Rescues convert into verified impact metrics, diverted meals, and carbon waste avoided.
              </p>
            </div>
            <Link to="/impact" className="pt-4">
              <Button size="sm" variant="secondary" className="w-full">
                <span>📊 View Impact ➔</span>
              </Button>
            </Link>
          </Card>
        </div>

        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-forest-text)] text-center max-w-2xl mx-auto">
          💡 Note: Timely decisions and efficient resource distribution minimize food waste and support local families!
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: OUR IMPACT DASHBOARD & CALCULATOR (#impact)
          ========================================================================= */}
      <section id="impact" className="py-12 bg-[var(--color-bg-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold font-['Quicksand'] bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] uppercase tracking-wider">
              Measurable Outcomes
            </span>
            <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-2">
              Our Impact Dashboard
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Tracking actual environmental and social savings through platform analytics.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-5 text-center bg-[var(--color-bg-subtle)]/60 border-[var(--color-border)]">
              <div className="font-['Fraunces'] text-3xl font-extrabold text-[var(--color-leaf-green)]">12,450</div>
              <div className="text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase mt-1">Meals Rescued</div>
            </Card>

            <Card className="p-5 text-center bg-[var(--color-bg-subtle)]/60 border-[var(--color-border)]">
              <div className="font-['Fraunces'] text-3xl font-extrabold text-[var(--color-tomato-orange)]">4,980</div>
              <div className="text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase mt-1">Food Waste Avoided (kg)</div>
            </Card>

            <Card className="p-5 text-center bg-[var(--color-bg-subtle)]/60 border-[var(--color-border)]">
              <div className="font-['Fraunces'] text-3xl font-extrabold text-[var(--color-mustard-dark)]">185,000</div>
              <div className="text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase mt-1">Impact Points Earned</div>
            </Card>

            <Card className="p-5 text-center bg-[var(--color-bg-subtle)]/60 border-[var(--color-border)]">
              <div className="font-['Fraunces'] text-3xl font-extrabold text-amber-800">480+</div>
              <div className="text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase mt-1">Active Student Rescuers</div>
            </Card>
          </div>

          {/* Interactive Impact Calculator */}
          <Card className="p-8 bg-[var(--color-bg-surface)] border-2 border-[var(--color-border)] shadow-[var(--shadow-warm-md)] space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="font-['Fraunces'] text-2xl font-bold text-[var(--color-forest-text)]">
                Interactive Food Waste Calculator
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Estimate the monthly community savings when your campus joins FoodBridge.
              </p>
            </div>

            <div className="max-w-xl mx-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-bold font-['Quicksand']">
                <span>Daily Surplus Rescued:</span>
                <span className="text-base font-extrabold text-[var(--color-leaf-green)]">
                  {dailyMealsSlider} meals/day
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={dailyMealsSlider}
                onChange={(e) => setDailyMealsSlider(Number(e.target.value))}
                className="w-full accent-[var(--color-leaf-green)] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] font-semibold">
                <span>20 meals/day</span>
                <span>500 meals/day</span>
                <span>1,000 meals/day</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-center">
                <div className="text-2xl mb-1">🍲</div>
                <div className="font-['Fraunces'] text-2xl font-bold text-[var(--color-forest-text)]">
                  {monthlyMeals.toLocaleString()}
                </div>
                <div className="text-[11px] font-bold text-[var(--color-text-muted)] font-['Quicksand'] mt-1">
                  Monthly Meals Diverted
                </div>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-center">
                <div className="text-2xl mb-1">⚖️</div>
                <div className="font-['Fraunces'] text-2xl font-bold text-[var(--color-tomato-orange)]">
                  {monthlyWasteKg.toLocaleString()} kg
                </div>
                <div className="text-[11px] font-bold text-[var(--color-text-muted)] font-['Quicksand'] mt-1">
                  Food Waste Avoided
                </div>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-center">
                <div className="text-2xl mb-1">🌿</div>
                <div className="font-['Fraunces'] text-2xl font-bold text-emerald-800">
                  {monthlyCo2Kg.toLocaleString()} kg
                </div>
                <div className="text-[11px] font-bold text-[var(--color-text-muted)] font-['Quicksand'] mt-1">
                  CO₂e Offset
                </div>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-center">
                <div className="text-2xl mb-1">🏆</div>
                <div className="font-['Fraunces'] text-2xl font-bold text-[var(--color-mustard-dark)]">
                  {monthlyPoints.toLocaleString()}
                </div>
                <div className="text-[11px] font-bold text-[var(--color-text-muted)] font-['Quicksand'] mt-1">
                  Community Points
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: JOIN A RESCUE DRIVE (#get-involved)
          ========================================================================= */}
      <section id="get-involved" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto">
          <span className="px-3 py-1 rounded-full text-xs font-bold font-['Quicksand'] bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] uppercase tracking-wider">
            Real-World Action
          </span>
          <h2 className="font-['Fraunces'] text-3xl sm:text-4xl font-extrabold text-[var(--color-forest-text)] mt-2">
            Join a Rescue Drive
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Students can participate in or document an actual surplus-food collection and redistribution activity, connecting our network to genuine community impact.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 3-Step Flow Column */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="p-6 border-[var(--color-border)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-leaf-green)] text-white font-['Fraunces'] font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1">
                <h4 className="font-['Fraunces'] text-base font-bold text-[var(--color-forest-text)]">Sign Up</h4>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Register your student profile or college volunteer team to get matched with nearby food surplus points.
                </p>
              </div>
            </Card>

            <Card className="p-6 border-[var(--color-border)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-mustard-dark)] text-white font-['Fraunces'] font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1">
                <h4 className="font-['Fraunces'] text-base font-bold text-[var(--color-forest-text)]">Collect and Deliver</h4>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Partner with campus canteens or local eateries to transport surplus food safely to designated shelters.
                </p>
              </div>
            </Card>

            <Card className="p-6 border-[var(--color-border)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-['Fraunces'] font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1">
                <h4 className="font-['Fraunces'] text-base font-bold text-[var(--color-forest-text)]">Document and Share</h4>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Log your drive details in the FoodBridge app to earn verified sustainability credits and leaderboards.
                </p>
              </div>
            </Card>
          </div>

          {/* Registration Form Column */}
          <div className="lg:col-span-6">
            <Card className="p-8 border-[var(--color-border)] shadow-[var(--shadow-warm-md)] space-y-4">
              <h3 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)]">
                Register for the Next Drive
              </h3>

              {regSubmitted ? (
                <div className="p-6 rounded-[var(--radius-md)] bg-emerald-50 border border-emerald-300 text-center space-y-2">
                  <div className="text-3xl">🎉</div>
                  <h4 className="font-['Fraunces'] text-lg font-bold text-emerald-900">
                    Registration Confirmed!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Thank you for joining FoodBridge, <strong>{regName}</strong>! Check your inbox ({regEmail}) for orientation details.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setRegSubmitted(false);
                      setRegName("");
                      setRegEmail("");
                      setRegOrg("");
                    }}
                    className="mt-3"
                  >
                    Register Another Member
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleDriveSignup} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] uppercase tracking-wider">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Rivera"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-xs outline-none focus:border-[var(--color-leaf-green)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] uppercase tracking-wider">
                      College / Organization
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. State University"
                      value={regOrg}
                      onChange={(e) => setRegOrg(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-xs outline-none focus:border-[var(--color-leaf-green)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="alex@university.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-xs outline-none focus:border-[var(--color-leaf-green)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] uppercase tracking-wider">
                      Interest Area
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-xs outline-none focus:border-[var(--color-leaf-green)]"
                    >
                      <option value="volunteer">Student Volunteer</option>
                      <option value="campus-lead">Campus Drive Lead</option>
                      <option value="canteen-partner">Canteen / Food Partner</option>
                      <option value="ngo">NGO / Community Center Partner</option>
                    </select>
                  </div>

                  <Button type="submit" variant="primary" className="w-full font-bold">
                    Register Profile
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
