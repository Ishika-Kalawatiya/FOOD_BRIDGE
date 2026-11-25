import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MapPinned } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { AuthModal } from "./components/AuthModal";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { useListings } from "./hooks/useListings";
import { subscribeDemoMode, checkBackendHealth, fetchImpactSummary, fetchMonthlyImpact } from "./services/api";

import { Loader } from "./components/ui/Loader";
import { useDeliveryTracking } from "./hooks/useDeliveryTracking";

import { LandingView } from "./views/LandingView";
const DeliveryMap = React.lazy(() => import("./components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })));
const DonateView = React.lazy(() => import("./views/DonateView").then((m) => ({ default: m.DonateView })));
const CourierView = React.lazy(() => import("./views/CourierView").then((m) => ({ default: m.CourierView })));
const NgoView = React.lazy(() => import("./views/NgoView").then((m) => ({ default: m.NgoView })));
const ImpactView = React.lazy(() => import("./views/ImpactView").then((m) => ({ default: m.ImpactView })));
const NotFoundView = React.lazy(() => import("./views/NotFoundView").then((m) => ({ default: m.NotFoundView })));

/**
 * Handles smooth scrolling to landing anchors (#problem, #how-it-works, #impact, #get-involved)
 * or scrolls to top on route change.
 */
function ScrollHandler() {
  const location = useLocation();

  useEffect(() => {
    const titles = {
      "/": "FoodBridge — Surplus Food Rescue Platform",
      "/donate": "Donate Surplus Food — FoodBridge",
      "/courier": "Delivery Partner Board — FoodBridge",
      "/ngo": "NGO Shelter Hub — FoodBridge",
      "/impact": "Quantified Impact & Audits — FoodBridge",
    };
    const title = titles[location.pathname] || "FoodBridge";
    document.title = title;

    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return null;
}

function MainAppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, activeRole, setActiveRole, authModalOpen, authModalOptions, openAuthModal, closeAuthModal, logout } = useAuth();
  const { listings, refresh, addListing, acceptNgo, claim, collect, arrive, arriveDropoff, startDelivery, distribute, deliver, cancel, totalDivertedMeals, availableListings } = useListings(5000);

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [impactData, setImpactData] = useState(null);
  const [myOrgImpactData, setMyOrgImpactData] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);
  const [trackingPreference, setTrackingPreference] = useState("gps");

  const handleAction = async (id, actionType, payload) => {
    if (actionType === "accept_ngo") return acceptNgo(id, payload);
    if (actionType === "claim") {
      const updated = await claim(id);
      setSelectedDeliveryId(id);
      setTrackingPreference("simulation");
      setIsMapOpen(true);
      if (location.pathname !== "/courier") {
        navigate("/courier");
      }
      return updated;
    }

    const stepSequence = [
      { action: "arrive", targetStatus: "arrived_at_pickup", fn: arrive },
      { action: "collect", targetStatus: "picked_up", fn: collect },
      { action: "start_delivery", targetStatus: "out_for_delivery", fn: startDelivery },
      { action: "arrive_dropoff", targetStatus: "arrived_at_dropoff", fn: arriveDropoff },
      { action: "deliver", targetStatus: "delivered", fn: deliver },
    ];
    const targetIndex = stepSequence.findIndex((s) => s.action === actionType);
    if (targetIndex !== -1) {
      const listing = listings.find((item) => String(item.id) === String(id));
      const statusOrder = ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered"];
      const currentIdx = Math.max(0, statusOrder.indexOf(listing?.status));
      let result = listing;
      for (let i = currentIdx; i <= targetIndex; i += 1) {
        result = await stepSequence[i].fn(id);
      }
      return result;
    }

    if (actionType === "distribute") return distribute(id);
    if (actionType === "cancel") return cancel(id);
    throw new Error(`Unsupported listing action: ${actionType}`);
  };

  const {
    activeDelivery: trackingDelivery,
    position: riderPosition,
    mode: trackingMode,
    error: trackingError,
    simRoute,
    simRemainingSeconds,
    simTotalSeconds,
    simProgress,
  } = useDeliveryTracking({
    listings,
    currentUser,
    activeRole,
    onRefresh: refresh,
    onAction: handleAction,
    trackingPreference,
    deliveryId: selectedDeliveryId,
  });

  useEffect(() => {
    if (!currentUser) {
      setIsMapOpen(false);
      setSelectedDeliveryId(null);
      setTrackingPreference("gps");
    }
  }, [currentUser]);

  useEffect(() => {
    checkBackendHealth();
    return subscribeDemoMode((active) => {
      setIsDemoMode(active);
    });
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const [sum, mth] = await Promise.all([fetchImpactSummary(), fetchMonthlyImpact()]);
        setImpactData(sum);
        setMyOrgImpactData(mth);
      } catch (error) {
        console.error("[FoodBridge] Could not load impact totals:", error);
      }
    }
    loadStats();
  }, [listings]);

  const handlePostListing = async (formData) => {
    const created = await addListing(formData);
    return created;
  };

  return (
    <div className="app-shell flex flex-col min-h-screen bg-[var(--color-bg-cream)] text-[var(--color-forest-text)]">
      <ScrollHandler />

      {/* Shared Unified Navbar */}
      <Navbar
        currentUser={currentUser}
        activeRole={activeRole}
        onSelectRole={setActiveRole}
        onOpenAuth={openAuthModal}
        onLogout={logout}
        onRefresh={refresh}
        totalDivertedMeals={totalDivertedMeals}
        activeListingsCount={availableListings.length}
        isDemoMode={isDemoMode}
      />

      {/* Main Route Content */}
      <main className="flex-1">
        <React.Suspense fallback={<Loader text="Loading FoodBridge view..." className="py-20" />}>
          <Routes>
          {/* Main SPA Pages */}
          <Route
            path="/"
            element={
              <LandingView
                totalDivertedMeals={totalDivertedMeals}
                activeListingsCount={availableListings.length}
                listings={listings}
                availableListings={availableListings}
                onAction={handleAction}
              />
            }
          />
          <Route
            path="/donate"
            element={
              <DonateView
                listings={listings}
                onPostListing={handlePostListing}
                onAction={handleAction}
              />
            }
          />
          <Route
            path="/courier"
            element={
              <CourierView
                listings={listings}
                onAction={handleAction}
                onOpenMap={(id) => {
                  setSelectedDeliveryId(id);
                  setIsMapOpen(true);
                }}
              />
            }
          />
          <Route
            path="/ngo"
            element={
              <NgoView
                listings={listings}
                onAction={handleAction}
              />
            }
          />
          <Route path="/portal" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/portal/:role" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/impact" element={<ImpactView />} />
          <Route path="/login" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/signup" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/game" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/lantern-preview" element={<Navigate to="/#light-your-lantern" replace />} />

          {/* Legacy multi-page route redirects */}
          <Route path="/portal.html" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/courier.html" element={<Navigate to="/courier" replace />} />
          <Route path="/donate.html" element={<Navigate to="/donate" replace />} />
          <Route path="/ngo-hub.html" element={<Navigate to="/ngo" replace />} />
          <Route path="/app.html" element={<Navigate to="/#light-your-lantern" replace />} />
          <Route path="/landing.html" element={<Navigate to="/" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFoundView />} />
        </Routes>
        </React.Suspense>
        {currentUser && !isMapOpen && (
          <button
            type="button"
            className="delivery-map-fab"
            onClick={() => setIsMapOpen(true)}
            aria-label="Open live delivery map"
          >
            <MapPinned className="w-5 h-5" />
            <span>Track Live Map</span>
          </button>
        )}
      </main>

      {/* Shared Unified Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} options={authModalOptions} />

      {currentUser && isMapOpen && (
        <React.Suspense fallback={<div className="delivery-map-shell"><Loader text="Loading live delivery map..." className="m-auto" /></div>}>
          <DeliveryMap
            listings={listings}
            selectedListingId={selectedDeliveryId}
            currentUser={currentUser}
            activeRole={activeRole}
            riderPosition={riderPosition}
            trackingMode={trackingMode}
            trackingError={trackingError}
            trackingDeliveryId={trackingDelivery?.id}
            trackingPreference={trackingPreference}
            simRoute={simRoute}
            simRemainingSeconds={simRemainingSeconds}
            simTotalSeconds={simTotalSeconds}
            simProgress={simProgress}
            onStartSimulation={() => setTrackingPreference("simulation")}
            onPauseSimulation={() => setTrackingPreference("paused")}
            onUseLiveGPS={() => setTrackingPreference("gps")}
            onSelectListing={setSelectedDeliveryId}
            onClose={() => setIsMapOpen(false)}
            onAction={handleAction}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <MainAppContent />
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
