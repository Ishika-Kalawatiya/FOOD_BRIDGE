import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  HeartHandshake,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  Utensils,
} from "lucide-react";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";

const rolePreviews = {
  donor: {
    label: "Donor",
    icon: Utensils,
    title: "Your surplus is on its way.",
    status: "Courier accepted · Alex is heading to pickup",
    primaryCall: ["Call Rider", "+919876543211"],
    secondaryCall: ["Call NGO", "+919876543212"],
    action: "Track pickup",
    notification: "Rider matched · Shelter notified",
  },
  ngo: {
    label: "NGO Shelter",
    icon: Building2,
    title: "A fresh delivery is approaching.",
    status: "Out for delivery · 08:40 remaining",
    primaryCall: ["Call Rider", "+919876543211"],
    secondaryCall: ["Call Donor", "+919876543210"],
    action: "Confirm arrival",
    notification: "Courier update · Donor notified",
  },
  volunteer: {
    label: "Delivery Partner",
    icon: Truck,
    title: "One smooth handoff at a time.",
    status: "Pickup confirmed · Route to shelter",
    primaryCall: ["Call Donor", "+919876543210"],
    secondaryCall: ["Call NGO", "+919876543212"],
    action: "Start delivery",
    notification: "Status synced · Donor + NGO notified",
  },
};

const statusSteps = [
  ["Listed", "Food is ready"],
  ["Accepted", "Courier matched"],
  ["Picked Up", "Safe handoff"],
  ["Delivered", "Shelter confirmed"],
];

function portions(listing) {
  return Number(listing.meals || listing.portions || 0);
}

function isUrgent(listing) {
  const expiry = new Date(listing.expires_at || listing.safe_until || 0).getTime();
  return Number.isFinite(expiry) && expiry > 0 && expiry - Date.now() < 60 * 60 * 1000;
}

function RescueFeedCard({ availableListings, filter, setFilter, onClaimRescue }) {
  const filteredListings = useMemo(() => availableListings.filter((listing) => {
    if (filter === "urgent") return isUrgent(listing);
    if (filter === "small") return portions(listing) <= 50;
    return true;
  }).slice(0, 3), [availableListings, filter]);

  return (
    <article id="live-surplus" className="landing-bento-card landing-bento-card--feed fb-card-3d fb-card-3d--interactive">
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker"><i /> RESCUE BOARD</span><h2>Food, ready to move.</h2></div>
        <a href="#live-surplus" aria-label="View all live rescues"><ArrowRight size={17} /></a>
      </header>
      <div className="landing-feed-filters" role="group" aria-label="Filter available food rescues">
        {[["all", "All"], ["urgent", "Urgent"], ["small", "≤ 50 portions"]].map(([value, label]) => (
          <button type="button" className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="landing-feed-list">
        {filteredListings.length ? filteredListings.map((listing) => (
          <div className="landing-feed-item" key={listing.id}>
            <span className="landing-feed-item__icon"><Utensils size={16} /></span>
            <div className="landing-feed-item__body">
              <strong>{listing.title || "Fresh surplus batch"}</strong>
              <span><MapPin size={12} /> {listing.pickup_address || listing.pickupAddress || "Pickup location provided"}</span>
              <span className="landing-feed-item__meta">
                <b>{portions(listing)} portions</b>
                {listing.expires_at && <ExpiryBadge expiresAt={listing.expires_at} />}
              </span>
            </div>
            <button type="button" className="landing-feed-claim" onClick={() => onClaimRescue(listing.id)}>
              Claim <ChevronRight size={14} />
            </button>
          </div>
        )) : (
          <div className="landing-feed-empty"><PackageCheck size={24} /><span>No rescues match this filter just now.</span></div>
        )}
      </div>
      <footer className="landing-bento-card__footnote">
        <span><Clock3 size={13} /> Pickup windows update live</span><span>{availableListings.length} ready</span>
      </footer>
    </article>
  );
}

function RoleSwitcherCard({ onEnterRole }) {
  const [activeRole, setActiveRole] = useState("donor");
  const preview = rolePreviews[activeRole];
  const Icon = preview.icon;

  return (
    <article id="portals" className="landing-bento-card landing-bento-card--roles fb-card-3d fb-card-3d--interactive">
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker">ONE RESCUE · THREE VIEWS</span><h2>Every handoff, in sync.</h2></div>
        <span className="landing-bento-icon"><HeartHandshake size={17} /></span>
      </header>
      <div className="landing-role-tabs" role="tablist" aria-label="Preview portals">
        {Object.entries(rolePreviews).map(([key, role]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === key}
            className={activeRole === key ? "is-active" : ""}
            key={key}
            onClick={() => setActiveRole(key)}
          >
            {role.label}
          </button>
        ))}
      </div>
      <div className="landing-role-preview" role="tabpanel">
        <div className="landing-role-preview__topline">
          <span><Icon size={16} /> {preview.label} portal</span>
          <span className="landing-role-preview__online"><i /> LIVE</span>
        </div>
        <h3>{preview.title}</h3>
        <p className="landing-role-preview__status"><Navigation size={14} /> {preview.status}</p>
        <div className="landing-role-preview__calls">
          {[preview.primaryCall, preview.secondaryCall].map(([label, phone]) => (
            <a href={`tel:${phone}`} key={label} aria-label={`${label} ${phone}`}><Phone size={13} /> {label}</a>
          ))}
        </div>
        <div className="landing-role-preview__notification">
          <BellRing size={14} /><span>{preview.notification}</span><Check size={14} />
        </div>
      </div>
      <button type="button" className="landing-role-open" onClick={() => onEnterRole(activeRole)}>
        Open {preview.label} portal <ArrowRight size={14} />
      </button>
    </article>
  );
}

function RoutePreviewCard({ isSimulating, onToggleSimulation }) {
  return (
    <article id="route-preview" className={`landing-bento-card landing-bento-card--route fb-card-3d fb-card-3d--interactive${isSimulating ? " is-simulating" : ""}`}>
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker">STREET-LEVEL ROUTING</span><h2>Good food, en route.</h2></div>
        <span className="landing-route-eta">08:40 <small>ETA</small></span>
      </header>
      <div className="landing-mini-map">
        <div className="landing-mini-map__grid" />
        <svg viewBox="0 0 360 180" role="presentation" aria-hidden="true">
          <path className="landing-mini-map__roads" d="M-12 142 47 108 88 116 118 68 167 78 205 35 252 51 292 21 370 44M6 38 53 64 85 43 127 79 150 122 210 133 244 103 300 119 365 88M-8 87 28 75 62 91 98 82 141 98 184 90 225 112 269 81 318 96 367 65" />
          <path className="landing-mini-map__street-line" d="M-12 142 47 108 88 116 118 68 167 78 205 35 252 51 292 21 370 44" />
        </svg>
        <span className="landing-mini-map__label landing-mini-map__label--pickup"><i /> KITCHEN</span>
        <span className="landing-mini-map__label landing-mini-map__label--dropoff"><i /> SHELTER</span>
        <span className="landing-mini-map__vehicle"><Truck size={16} /></span>
        <span className="landing-mini-map__distance">1.2 km · route clear</span>
      </div>
      <div className="landing-route-controls">
        <span><span className="landing-live-dot" /> {isSimulating ? "Rider moving on route" : "Ready for a live preview"}</span>
        <button type="button" onClick={onToggleSimulation}>{isSimulating ? "Pause rider" : "Simulate rider"}</button>
      </div>
    </article>
  );
}

function ImpactCard({ listings, totalDivertedMeals, availableCount }) {
  const cardRef = useRef(null);
  const frameRef = useRef(0);
  const [values, setValues] = useState([0, 0, 0, 0]);
  const deliveredStatuses = new Set(["delivered", "distributed"]);
  const postedMeals = listings.filter((listing) => !["cancelled", "expired"].includes(listing.status)).reduce((sum, listing) => sum + portions(listing), 0);
  const rescuedMeals = listings.filter((listing) => deliveredStatuses.has(listing.status)).reduce((sum, listing) => sum + portions(listing), 0);
  const kitchens = new Set(listings.map((listing) => listing.donor_id || listing.donor_org).filter(Boolean)).size;
  const ngos = new Set(listings.map((listing) => listing.ngo_id || listing.ngo_org).filter(Boolean)).size;
  const zeroLandfillRate = postedMeals ? Math.round((rescuedMeals / postedMeals) * 100) : 0;
  const targets = [Number(totalDivertedMeals) || rescuedMeals, kitchens, ngos, zeroLandfillRate];

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;
    let started = false;
    let observer;
    const animate = () => {
      if (started) return;
      started = true;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        setValues(targets);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / 1100);
        const eased = 1 - (1 - progress) ** 3;
        setValues(targets.map((target) => Math.round(target * eased)));
        if (progress < 1) frameRef.current = window.requestAnimationFrame(tick);
      };
      frameRef.current = window.requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) {
      animate();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(node);
    }
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [totalDivertedMeals, kitchens, ngos, zeroLandfillRate]);

  return (
    <article id="impact" ref={cardRef} className="landing-bento-card landing-bento-card--impact fb-card-3d">
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker">SMALL ACTS · REAL IMPACT</span><h2>Good food adds up.</h2></div>
        <Sparkles size={18} className="landing-impact-sparkle" />
      </header>
      <div className="landing-impact-grid">
        {[
          [values[0].toLocaleString(), "Meals rescued"],
          [values[1].toLocaleString(), "Partner kitchens"],
          [values[2].toLocaleString(), "Verified NGOs"],
          [`${values[3]}%`, "Zero-landfill rate"],
        ].map(([value, label]) => (
          <div className="landing-impact-metric" key={label}>
            <strong>{value}</strong><span>{label}</span>
          </div>
        ))}
      </div>
      <p className="landing-impact-note">{availableCount} live rescues · numbers refresh with the network</p>
    </article>
  );
}

function SafetyCard() {
  return (
    <article className="landing-bento-card landing-bento-card--safety fb-card-3d">
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker">CAREFUL AT EVERY STEP</span><h2>Safe food. Clear handoffs.</h2></div>
        <ShieldCheck size={19} className="landing-safety-shield" />
      </header>
      <ol className="landing-safety-timeline">
        {statusSteps.map(([title, detail], index) => (
          <li className={index === 0 ? "is-current" : ""} key={title}>
            <span className="landing-safety-timeline__step">{index === 0 ? <Check size={13} /> : index + 1}</span>
            <span><strong>{title}</strong><small>{detail}</small></span>
          </li>
        ))}
      </ol>
      <div className="landing-safety-caption"><ShieldCheck size={14} /> Time-window &amp; temperature-aware coordination</div>
    </article>
  );
}

function CommunityCard() {
  return (
    <article className="landing-bento-card landing-bento-card--community fb-card-3d fb-card-3d--interactive">
      <header className="landing-bento-card__header">
        <div><span className="landing-bento-kicker">THE PEOPLE BEHIND EACH PLATE</span><h2>A neighborhood table.</h2></div>
        <HeartHandshake size={18} className="landing-community-heart" />
      </header>
      <div className="landing-partner-strip" aria-label="FoodBridge community partners">
        <span><i>GV</i> Green Valley Dining</span>
        <span><i>HS</i> Hope Shelter</span>
        <span><i>SR</i> Swift Rescue</span>
      </div>
      <blockquote>
        “A clear pickup window and a kind courier turn surplus into something our neighbors can count on.”
        <cite>— Community kitchen partner</cite>
      </blockquote>
    </article>
  );
}

export function LandingBentoExperience({
  availableListings = [],
  listings = [],
  totalDivertedMeals = 0,
  onClaimRescue,
  onEnterRole,
  isSimulating,
  onToggleSimulation,
}) {
  const [filter, setFilter] = useState("all");
  const revealRef = useRef(null);

  useEffect(() => {
    const container = revealRef.current;
    if (!container) return undefined;
    const cards = container.querySelectorAll(".landing-bento-card");
    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-bento-section" aria-labelledby="landing-bento-title">
      <div className="landing-bento-intro">
        <span className="landing-bento-kicker"><i /> EVERYTHING HAPPENING ON FOODBRIDGE</span>
        <h2 id="landing-bento-title">One connected rescue network.</h2>
        <p>From the first listing to the final handoff, every detail has a place.</p>
      </div>
      <div ref={revealRef} className="landing-bento-grid">
        <RescueFeedCard
          availableListings={availableListings}
          filter={filter}
          setFilter={setFilter}
          onClaimRescue={onClaimRescue}
        />
        <RoleSwitcherCard onEnterRole={onEnterRole} />
        <RoutePreviewCard isSimulating={isSimulating} onToggleSimulation={onToggleSimulation} />
        <ImpactCard listings={listings} totalDivertedMeals={totalDivertedMeals} availableCount={availableListings.length} />
        <SafetyCard />
        <CommunityCard />
      </div>
    </section>
  );
}
