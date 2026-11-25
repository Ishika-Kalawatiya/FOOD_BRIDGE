import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Clock3,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Utensils,
} from "lucide-react";
import { Button } from "../../components/ui/Button";

const foodPhoto = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1800&q=85";
const demoTicker = [
  "40 Portions Pasta · 1.2 km away · Courier matched",
  "35 Sandwich packs · Pickup window closing soon",
  "50 Fresh curry meals · Shelter handoff confirmed",
];
const parcelStarts = [
  { x: 30, y: 58, landingX: 75, landingY: 72, delay: 0 },
  { x: 33, y: 67, landingX: 81, landingY: 68, delay: 0.035 },
  { x: 27, y: 52, landingX: 70, landingY: 75, delay: 0.07 },
];

const storyPhases = [
  {
    step: "01",
    eyebrow: "LIFT-OFF · 0—35%",
    title: <>Good food rises above <em>food waste.</em></>,
    description: "A few extra meals lift off from the kitchen and begin a better journey.",
  },
  {
    step: "02",
    eyebrow: "THE BRIDGE · 35—75%",
    title: <>A glowing bridge moves meals <em>forward.</em></>,
    description: "Freshness is protected as each parcel glides toward a community shelter.",
  },
  {
    step: "03",
    eyebrow: "A PLACE AT THE TABLE · 75—100%",
    title: <>Every rescue finds a place at the <em>table.</em></>,
    description: "Gravity returns gently. Good food lands safely, ready to be shared.",
  },
];

const clamp = (value) => Math.min(1, Math.max(0, value));
const smoothStep = (value) => value * value * (3 - 2 * value);

function MiniRouteCard() {
  return (
    <aside className="story-route-card" aria-label="Live courier route preview">
      <div className="story-route-card__top">
        <span><i /> LIVE COURIER</span>
        <strong><Clock3 size={12} /> 08:40</strong>
      </div>
      <div className="story-route-map">
        <span className="story-route-map__label story-route-map__label--start">KITCHEN</span>
        <span className="story-route-map__label story-route-map__label--end">SHELTER</span>
        <svg viewBox="0 0 280 94" role="presentation" aria-hidden="true">
          <path className="story-route-map__road" d="M5 72c42-22 60-42 97-32s50 25 77 7 52-28 96-15" />
          <path className="story-route-map__path" d="M5 72c42-22 60-42 97-32s50 25 77 7 52-28 96-15" />
        </svg>
        <span className="story-route-map__rider"><Truck size={13} /></span>
        <span className="story-route-map__pin story-route-map__pin--start"><MapPin size={12} /></span>
        <span className="story-route-map__pin story-route-map__pin--end"><HeartHandshake size={12} /></span>
      </div>
      <div className="story-route-card__foot">
        <span><b>Courier Alex</b><small>Matched to this rescue</small></span>
        <span className="story-route-card__avatar">CA</span>
      </div>
    </aside>
  );
}

function TiffinParcel({ index, setRef }) {
  return (
    <div className={`story-tiffin story-tiffin--${index + 1}`} ref={setRef} aria-hidden="true">
      <span className="story-tiffin__steam"><i /><i /><i /></span>
      <span className="story-tiffin__lid"><i /></span>
      <span className="story-tiffin__body">
        <span className="story-tiffin__food"><i /><i /><i /><b /></span>
        <span className="story-tiffin__shine" />
      </span>
      <span className="story-tiffin__clip" />
      <span className="story-tiffin__handle" />
      <span className="story-tiffin__label"><Utensils size={12} /> FRESH MEALS</span>
    </div>
  );
}

export function LandingRescueHero({ availableListings = [], onWatchDemo }) {
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const parcelRefs = useRef([]);
  const progressRef = useRef(null);
  const progressTextRef = useRef(null);
  const [phase, setPhase] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);

  const tickerItems = useMemo(() => (
    availableListings.length
      ? availableListings.slice(0, 3).map((listing) => {
        const meals = Number(listing.meals || 0);
        const location = listing.pickup_address || listing.pickupAddress || "Nearby kitchen";
        return `${meals} Portions · ${location} · Ready for rescue`;
      })
      : demoTicker
  ), [availableListings]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || tickerItems.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setTickerIndex((index) => (index + 1) % tickerItems.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [tickerItems.length]);

  useEffect(() => {
    let frameId = 0;
    let previousPhase = -1;
    const updateStory = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const track = trackRef.current;
        const stage = stageRef.current;
        if (!track || !stage) return;
        const bounds = track.getBoundingClientRect();
        const travel = Math.max(1, track.offsetHeight - window.innerHeight);
        const progress = clamp(-bounds.top / travel);
        const lift = smoothStep(clamp(progress / 0.35));
        const glide = smoothStep(clamp((progress - 0.35) / 0.4));
        const settle = smoothStep(clamp((progress - 0.75) / 0.25));
        const bridgeVisibility = glide * (1 - settle);
        stage.style.setProperty("--story-progress", String(progress));
        stage.style.setProperty("--story-glide", String(bridgeVisibility));
        stage.style.setProperty("--story-settle", String(settle));
        stage.style.setProperty("--story-waste-opacity", String(1 - progress));
        stage.style.setProperty("--story-waste-scale", String(0.88 + (1 - progress) * 0.12));
        stage.style.setProperty("--story-ring-opacity", String(glide));
        stage.style.setProperty("--story-table-glow", String(settle));
        stage.style.setProperty("--story-table-opacity", String(0.76 + settle * 0.24));
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
        if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(progress * 100)}%`;

        parcelRefs.current.forEach((element, index) => {
          if (!element) return;
          const item = parcelStarts[index];
          const localProgress = clamp((progress - item.delay) / (1 - item.delay));
          const localLift = smoothStep(clamp(localProgress / 0.35));
          const localGlide = smoothStep(clamp((localProgress - 0.35) / 0.4));
          const localSettle = smoothStep(clamp((localProgress - 0.75) / 0.25));
          const drift = Math.sin(localProgress * Math.PI * 7 + index * 1.4) * (1 - localSettle) * 1.8;
          const x = item.x + (item.landingX - item.x) * localGlide;
          const liftY = item.y - 22;
          const y = item.y - localLift * 22 + drift + localSettle * (item.landingY - liftY);
          const flip = Math.sin(localProgress * Math.PI * 2.5 + index) * 28 * (1 - localSettle);
          const roll = Math.sin(localProgress * Math.PI * 3 + index * 0.8) * 11 * (1 - localSettle);
          const rotation = (1 - localSettle) * Math.sin(localProgress * Math.PI * 3 + index) * 8;
          element.style.left = `${x}%`;
          element.style.top = `${y}%`;
          element.style.transform = `translate(-50%, -50%) perspective(900px) rotateX(${flip}deg) rotateY(${roll}deg) rotateZ(${rotation}deg)`;
          element.style.opacity = String(Math.min(1, 0.82 + localLift * 0.18));
        });

        const nextPhase = progress < 0.35 ? 0 : progress < 0.75 ? 1 : 2;
        if (nextPhase !== previousPhase) {
          previousPhase = nextPhase;
          setPhase(nextPhase);
        }
      });
    };

    updateStory();
    window.addEventListener("scroll", updateStory, { passive: true });
    window.addEventListener("resize", updateStory);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateStory);
      window.removeEventListener("resize", updateStory);
    };
  }, []);

  const currentPhase = storyPhases[phase];

  return (
    <section className="zero-g-story" id="home">
      <div className="zero-g-story__track" ref={trackRef}>
        <div className="zero-g-story__stage" ref={stageRef}>
          <div className={`zero-g-story__backdrop${photoFailed ? " is-fallback" : ""}`}>
            {!photoFailed && <img src={foodPhoto} alt="" fetchPriority="high" onError={() => setPhotoFailed(true)} />}
          </div>
          <div className="zero-g-story__shade" aria-hidden="true" />
          <div className="zero-g-story__waste" aria-hidden="true">
            <span className="zero-g-story__waste-vortex" />
            <span className="zero-g-story__bin"><Trash2 size={29} /></span>
            <span className="zero-g-story__waste-label">FOOD WASTE</span>
            <span className="zero-g-story__counter"><i /><i /><i /><b /></span>
            <span className="zero-g-story__counter-label">KITCHEN COUNTER</span>
          </div>

          <svg className="zero-g-story__portal-art" viewBox="0 0 1440 800" preserveAspectRatio="none" role="presentation" aria-hidden="true">
            <defs>
              <radialGradient id="zero-g-aura">
                <stop offset="0" stopColor="#ffe7a4" stopOpacity=".4" />
                <stop offset=".55" stopColor="#e9a74f" stopOpacity=".2" />
                <stop offset="1" stopColor="#e9a74f" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="zero-g-bridge" x1="0" x2="1">
                <stop offset="0" stopColor="#f8d48a" stopOpacity=".15" />
                <stop offset=".5" stopColor="#fff0b7" stopOpacity=".98" />
                <stop offset="1" stopColor="#f8d48a" stopOpacity=".14" />
              </linearGradient>
              <filter id="zero-g-blur"><feGaussianBlur stdDeviation="17" /></filter>
            </defs>
            <ellipse cx="820" cy="404" rx="263" ry="265" fill="url(#zero-g-aura)" filter="url(#zero-g-blur)" />
            <path className="zero-g-story__bridge-glow" d="M400 539c128-139 249-185 391-159 91 17 157 73 249 138" fill="none" stroke="url(#zero-g-bridge)" strokeWidth="52" strokeLinecap="round" />
            <path className="zero-g-story__bridge-path" d="M400 539c128-139 249-185 391-159 91 17 157 73 249 138" fill="none" stroke="#fff4cc" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 18" />
            <ellipse className="zero-g-story__ring-outer" cx="818" cy="396" rx="118" ry="194" fill="none" stroke="#ffdf91" strokeWidth="17" />
            <ellipse className="zero-g-story__ring-inner" cx="818" cy="396" rx="99" ry="174" fill="none" stroke="#fff1bc" strokeWidth="4" />
            <ellipse className="zero-g-story__ring-core" cx="818" cy="396" rx="81" ry="152" fill="none" stroke="#e99652" strokeWidth="2" strokeDasharray="24 17" />
            <path d="M755 511c31-70 53-144 63-248 10 104 31 178 63 248" fill="none" stroke="#fff4d5" strokeWidth="4" opacity=".58" />
          </svg>
          <div className="zero-g-story__table" aria-hidden="true">
            <span className="zero-g-story__table-light" />
            <span className="zero-g-story__plate"><i /></span>
            <span className="zero-g-story__table-top" />
            <span className="zero-g-story__table-leg zero-g-story__table-leg--left" />
            <span className="zero-g-story__table-leg zero-g-story__table-leg--right" />
            <span className="zero-g-story__table-label">SHELTER TABLE · READY TO SHARE</span>
          </div>

          <div className="zero-g-story__sparks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>
          <div className="zero-g-story__bubbles" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
          </div>
          {parcelStarts.map((_, index) => (
            <TiffinParcel
              key={index}
              index={index}
              setRef={(element) => { parcelRefs.current[index] = element; }}
            />
          ))}

          <div className="zero-g-story__topbar">
            <div className="zero-g-story__progress">
              <span>SCROLL STORY</span>
              <strong ref={progressTextRef}>0%</strong>
              <i><b ref={progressRef} /></i>
            </div>
            <a className="zero-g-story__skip" href="#portals">Skip to Portals <ArrowDown size={14} /></a>
          </div>

          <div className="zero-g-story__copy" aria-live="polite">
            <p className="zero-g-story__eyebrow"><span /> FOODBRIDGE · {currentPhase.eyebrow}</p>
            <h1 key={phase}>{currentPhase.title}</h1>
            <p>{currentPhase.description}</p>
            <div className="zero-g-story__actions">
              <Button to="/donate" size="md" className="zero-g-story__donate">
                Donate Surplus Food <ArrowRight size={15} />
              </Button>
              <a href="#route-preview" onClick={onWatchDemo}>Watch Live Demo <ArrowRight size={14} /></a>
            </div>
            <div className="zero-g-story__ticker" aria-live="polite">
              <span><i /> LIVE RESCUE</span>
              <p key={tickerIndex}>{tickerItems[tickerIndex % tickerItems.length]}</p>
            </div>
          </div>

          <MiniRouteCard />
          <div className="zero-g-story__safety">
            <ShieldCheck size={17} /><span><b>Freshness verified</b><small>Temp checked · 98% window</small></span><i>✓</i>
          </div>
          <div className="zero-g-story__impact-toast">
            <span><HeartHandshake size={16} /></span>
            <span><b>+40 meals saved</b><small>18 kg CO₂ avoided</small></span>
            <BellRing size={14} />
          </div>
          <div className="zero-g-story__bridge-badges" aria-hidden="true">
            <span><Sparkles size={13} /> Freshness Preserved</span>
            <span><Truck size={13} /> Courier Matched</span>
            <span><HeartHandshake size={13} /> Zero Waste</span>
          </div>
          <div className="zero-g-story__phase-index" aria-hidden="true">
            <span>{currentPhase.step}</span><i /><span>03</span>
          </div>
          <div className="zero-g-story__bottom-note">
            <span>GOOD FOOD MOVES PEOPLE</span>
            <a href="#live-surplus">Explore live rescues <ArrowRight size={13} /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
