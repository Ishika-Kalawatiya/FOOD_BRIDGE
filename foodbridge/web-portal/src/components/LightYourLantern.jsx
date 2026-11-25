import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Download,
  Flame,
  Heart,
  LockKeyhole,
  MapPinned,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { issueServiceCertificate } from "../services/api";
import { useToast } from "./ui/Toast";

const lanterns = [
  { id: "hope", name: "Hope", color: "#f2b33d", glow: "rgba(242, 179, 61, 0.35)", message: "A brighter path forward" },
  { id: "kindness", name: "Kindness", color: "#e88362", glow: "rgba(232, 131, 98, 0.35)", message: "Small acts, lasting warmth" },
  { id: "community", name: "Community", color: "#74a880", glow: "rgba(116, 168, 128, 0.35)", message: "Together, meals reach home" },
  { id: "gratitude", name: "Gratitude", color: "#c89bce", glow: "rgba(200, 155, 206, 0.35)", message: "Thank you for showing up" },
  { id: "courage", name: "Courage", color: "#78a6c5", glow: "rgba(120, 166, 197, 0.35)", message: "Care in motion" },
  { id: "care", name: "Care", color: "#e4a77d", glow: "rgba(228, 167, 125, 0.35)", message: "A little light goes far" },
];

const roleLabels = {
  donor: "Food Donor",
  volunteer: "Volunteer Courier",
  ngo: "NGO / Shelter Partner",
};

const roleEligibilityNotes = {
  donor: "Requires at least 1 surplus food donation posted by your Donor account.",
  volunteer: "Requires at least 1 order delivered by your Volunteer account.",
  ngo: "Requires at least 1 delivered order accepted/confirmed by your NGO account.",
};

const roleDestinations = {
  donor: { to: "/donate", label: "Make a Donation First" },
  volunteer: { to: "/courier", label: "Deliver an Order First" },
  ngo: { to: "/ngo", label: "Accept a Shelter Order First" },
};

function LanternIcon({ color, lit = false, size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="34" r={lit ? 26 : 21} fill={color} opacity={lit ? 0.32 : 0.16} />
      <path d="M26 11h12M32 6v5" stroke="#2f5d3a" strokeWidth="2.8" strokeLinecap="round" />
      <rect x="23" y="13" width="18" height="4" rx="2" fill="#2f5d3a" />
      <path
        d="M19 23c0-5 5-8 13-8s13 3 13 8v19c0 6-5 10-13 10s-13-4-13-10V23Z"
        fill={color}
        stroke="#1f3326"
        strokeWidth="2.4"
      />
      <path d="M25 16v35M39 16v35" stroke="#1f3326" strokeOpacity="0.24" strokeWidth="1.6" />
      <path
        d="M32 24c3 4 4.5 6.8 4.5 9.2a4.5 4.5 0 1 1-9 0c0-2.4 1.5-5.2 4.5-9.2Z"
        fill="#fff8ec"
      />
      <rect x="24" y="51" width="16" height="4" rx="2" fill="#2f5d3a" />
      <path d="M32 55v5" stroke="#2f5d3a" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Plays a short celebratory chime using the Web Audio API (zero external assets).
 */
function playCelebrationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.68);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 1800);
  } catch (_e) {}
}

/**
 * Draws the official FoodBridge mascot + bridge shield logo onto a 2D canvas.
 */
function drawFoodBridgeLogoOnCanvas(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 64;
  ctx.scale(scale, scale);

  // Shield background
  ctx.fillStyle = "rgba(46, 125, 79, 0.14)";
  ctx.strokeStyle = "rgba(46, 125, 79, 0.32)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, 60, 60, 18);
  ctx.fill();
  ctx.stroke();

  // Arch bridge
  ctx.strokeStyle = "#2E7D4F";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, 48);
  ctx.quadraticCurveTo(32, 24, 54, 48);
  ctx.stroke();

  ctx.fillStyle = "#2E7D4F";
  ctx.beginPath();
  ctx.arc(12, 48, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F6A623";
  ctx.beginPath();
  ctx.arc(52, 48, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Cute Apple Mascot
  ctx.fillStyle = "#EE5253";
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.bezierCurveTo(24, 16, 17, 22, 17, 31);
  ctx.bezierCurveTo(17, 40, 24, 45, 32, 45);
  ctx.bezierCurveTo(40, 45, 47, 40, 47, 31);
  ctx.bezierCurveTo(47, 22, 40, 16, 32, 16);
  ctx.fill();

  // Leaf
  ctx.fillStyle = "#43A047";
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.bezierCurveTo(30, 11, 24, 10, 22, 13);
  ctx.bezierCurveTo(24, 16, 28, 17, 32, 16);
  ctx.fill();

  // Eyes & Smile
  ctx.fillStyle = "#1F3326";
  ctx.beginPath();
  ctx.arc(27, 30, 2.2, 0, Math.PI * 2);
  ctx.arc(37, 30, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1F3326";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(29.5, 33.5);
  ctx.quadraticCurveTo(32, 37, 34.5, 33.5);
  ctx.stroke();

  // Care Heart
  ctx.fillStyle = "#E53935";
  ctx.beginPath();
  ctx.arc(41.5, 13.5, 2.2, 0, Math.PI * 2);
  ctx.arc(44.5, 13.5, 2.2, 0, Math.PI * 2);
  ctx.lineTo(43, 19);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let currentY = y;
  for (let i = 0; i < words.length; i += 1) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

function renderCertificatePng(certificate) {
  const lantern = lanterns.find((item) => item.id === certificate.lanternId) || lanterns[0];
  const roleTitle = roleLabels[certificate.role] || "Community Member";
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");

  // Parchment background
  const bgGrad = ctx.createLinearGradient(0, 0, 1400, 960);
  bgGrad.addColorStop(0, "#FFFDF8");
  bgGrad.addColorStop(0.55, "#FFF8EC");
  bgGrad.addColorStop(1, "#F7ECD8");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1400, 960);

  // Outer & inner certificate frames
  ctx.strokeStyle = "#2F5D3A";
  ctx.lineWidth = 14;
  ctx.strokeRect(32, 32, 1336, 896);
  ctx.strokeStyle = "#D4A64A";
  ctx.lineWidth = 4;
  ctx.strokeRect(52, 52, 1296, 856);
  ctx.strokeStyle = "#E6D9C8";
  ctx.lineWidth = 2;
  ctx.strokeRect(66, 66, 1268, 828);

  // Brand header: FoodBridge Logo + Name
  drawFoodBridgeLogoOnCanvas(ctx, 515, 92, 68);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1F3326";
  ctx.font = "bold 40px Georgia, serif";
  ctx.fillText("Food", 598, 134);
  const foodWidth = ctx.measureText("Food").width;
  ctx.fillStyle = "#2F5D3A";
  ctx.fillText("Bridge", 598 + foodWidth, 134);
  ctx.fillStyle = "#566E5E";
  ctx.font = "600 15px Arial, sans-serif";
  ctx.fillText("SURPLUS FOOD RESCUE & SOCIAL SERVICE", 598, 158);

  // Main Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#1F3326";
  ctx.font = "bold 54px Georgia, serif";
  ctx.fillText("Certificate of Community Service", 700, 250);

  // Congratulations message
  ctx.fillStyle = "#B86B15";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(`CONGRATULATIONS — YOU LIT A LAMP! (${lantern.name.toUpperCase()} LANTERN)`, 700, 298);

  // Presented to
  ctx.fillStyle = "#566E5E";
  ctx.font = "italic 24px Georgia, serif";
  ctx.fillText("This authentic social service certificate is proudly presented to", 700, 360);

  // Recipient Name
  ctx.fillStyle = "#2F5D3A";
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText(certificate.name, 700, 442);

  // Divider line under name
  ctx.strokeStyle = "#D4A64A";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 464);
  ctx.lineTo(1050, 464);
  ctx.stroke();

  // Role Pill
  ctx.fillStyle = `${lantern.color}33`;
  ctx.strokeStyle = lantern.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(520, 488, 360, 42, 21);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1F3326";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText(roleTitle.toUpperCase(), 700, 515);

  // Message
  ctx.fillStyle = "#1F3326";
  ctx.font = "25px Georgia, serif";
  const message = `In heartfelt appreciation for verified social service in helping rescue ${Number(certificate.meals)} meals (${certificate.serviceTitle}), turning surplus food into community nourishment and zero-waste impact.`;
  wrapCanvasText(ctx, message, 700, 584, 1020, 36);

  // Official Seal on right
  ctx.save();
  ctx.translate(1155, 765);
  ctx.fillStyle = "#EAF3EC";
  ctx.strokeStyle = "#2F5D3A";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#D4A64A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#2F5D3A";
  ctx.textAlign = "center";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("FOODBRIDGE", 0, -18);
  ctx.font = "bold 18px Georgia, serif";
  ctx.fillText("AUTHENTIC", 0, 6);
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText("VERIFIED SEAL", 0, 28);
  ctx.restore();

  // Footer Metadata
  ctx.textAlign = "left";
  ctx.fillStyle = "#566E5E";
  ctx.font = "bold 17px Arial, sans-serif";
  ctx.fillText(`Issued On: ${issuedDate}`, 120, 758);
  ctx.fillText(`Credential ID: ${certificate.id}`, 120, 792);

  // Signature block
  ctx.textAlign = "center";
  ctx.strokeStyle = "#1F3326";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(640, 788);
  ctx.lineTo(940, 788);
  ctx.stroke();
  ctx.fillStyle = "#1F3326";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("FoodBridge Community Registry", 790, 774);
  ctx.fillStyle = "#566E5E";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("AUTHORIZED DIGITAL SIGNATURE", 790, 812);

  return canvas.toDataURL("image/png");
}

function renderBadgePng(certificate) {
  const lantern = lanterns.find((item) => item.id === certificate.lanternId) || lanterns[0];
  const roleTitle = roleLabels[certificate.role] || "Community Member";

  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");

  // Warm card backdrop
  const bgGrad = ctx.createRadialGradient(480, 400, 60, 480, 480, 520);
  bgGrad.addColorStop(0, "#FFFDF8");
  bgGrad.addColorStop(1, "#F6EDE0");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 960, 960, 96);
  ctx.fill();

  // Outer shield ring
  ctx.strokeStyle = "#2F5D3A";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(480, 480, 430, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([16, 10]);
  ctx.strokeStyle = lantern.color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(480, 480, 404, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Top FoodBridge Logo + Name inside badge
  drawFoodBridgeLogoOnCanvas(ctx, 354, 108, 56);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1F3326";
  ctx.font = "bold 34px Georgia, serif";
  ctx.fillText("FoodBridge", 422, 148);

  // Glowing Lantern Emblem in center
  ctx.fillStyle = `${lantern.color}44`;
  ctx.beginPath();
  ctx.arc(480, 325, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lantern.color;
  ctx.strokeStyle = "#1F3326";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(422, 236, 116, 152, 36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2F5D3A";
  ctx.fillRect(436, 220, 88, 18);
  ctx.fillRect(436, 386, 88, 18);
  // Flame
  ctx.fillStyle = "#FFF8EC";
  ctx.beginPath();
  ctx.moveTo(480, 272);
  ctx.quadraticCurveTo(506, 310, 480, 350);
  ctx.quadraticCurveTo(454, 310, 480, 272);
  ctx.fill();

  // Badge Messages & Name
  ctx.textAlign = "center";
  ctx.fillStyle = "#B86B15";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText("CONGRATULATIONS — YOU LIT A LAMP!", 480, 486);

  ctx.fillStyle = "#1F3326";
  ctx.font = "bold 50px Georgia, serif";
  ctx.fillText(certificate.name, 480, 554);

  ctx.fillStyle = "#2F5D3A";
  ctx.font = "bold 25px Arial, sans-serif";
  ctx.fillText(`${roleTitle.toUpperCase()} · ${Number(certificate.meals)} MEALS RESCUED`, 480, 606);

  ctx.fillStyle = "#566E5E";
  ctx.font = "22px Georgia, serif";
  wrapCanvasText(
    ctx,
    `Awarded for authentic social service (${lantern.name} Lantern) on FoodBridge.`,
    480,
    658,
    640,
    30
  );

  // Credential ribbon at bottom
  ctx.fillStyle = "#2F5D3A";
  ctx.beginPath();
  ctx.roundRect(240, 742, 480, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#FFF8EC";
  ctx.font = "bold 20px monospace";
  ctx.fillText(certificate.id, 480, 775);

  return canvas.toDataURL("image/png");
}

function downloadPngDataUrl(filename, dataUrl) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function CelebrationBackdrop() {
  const ribbons = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 17 + 3) % 98}%`,
        delay: `${(index % 9) * 0.22}s`,
        duration: `${3.2 + (index % 5) * 0.55}s`,
        color: ["#f2b33d", "#e8643c", "#4fa36b", "#c89bce", "#60a5fa", "#fb7185"][index % 6],
        rotate: `${(index * 47) % 360}deg`,
      })),
    []
  );

  const balloons = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: index,
        left: `${5 + index * 9.5}%`,
        delay: `${(index % 5) * 0.3}s`,
        duration: `${4.6 + (index % 4) * 0.6}s`,
        color: ["#f2b33d", "#e8643c", "#4fa36b", "#c89bce", "#60a5fa"][index % 5],
      })),
    []
  );

  return (
    <div className="lantern-celebration-backdrop" aria-hidden="true">
      {ribbons.map((ribbon) => (
        <span
          key={`r-${ribbon.id}`}
          className="lantern-falling-ribbon"
          style={{
            left: ribbon.left,
            animationDelay: ribbon.delay,
            animationDuration: ribbon.duration,
            backgroundColor: ribbon.color,
            "--ribbon-rot": ribbon.rotate,
          }}
        />
      ))}
      {balloons.map((balloon) => (
        <span
          key={`b-${balloon.id}`}
          className="lantern-floating-balloon"
          style={{
            left: balloon.left,
            animationDelay: balloon.delay,
            animationDuration: balloon.duration,
            backgroundColor: balloon.color,
          }}
        />
      ))}
    </div>
  );
}

function VolunteerRouteSimulationMap({ certificate }) {
  const routePathRef = useRef(null);
  const [mapRunning, setMapRunning] = useState(true);
  const [runCycle, setRunCycle] = useState(0);
  const [vehicleState, setVehicleState] = useState({ x: 38, y: 99, angle: 0, progress: 0 });

  useEffect(() => {
    const pathEl = routePathRef.current;
    if (!pathEl) return undefined;

    const totalLength = pathEl.getTotalLength();
    const durationMs = 5200;
    const startTime = performance.now();
    let frameId = 0;

    setMapRunning(true);

    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) ** 2;
      const dist = eased * totalLength;
      const pt = pathEl.getPointAtLength(dist);
      const ahead = pathEl.getPointAtLength(Math.min(totalLength, dist + 4));
      const angle = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * (180 / Math.PI);

      setVehicleState({
        x: pt.x,
        y: pt.y,
        angle: Number.isFinite(angle) ? angle : 0,
        progress: Math.round(t * 100),
      });

      if (t < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setMapRunning(false);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [certificate?.id, runCycle]);

  const leftPct = (vehicleState.x / 440) * 100;
  const topPct = (vehicleState.y / 150) * 100;

  return (
    <div className="light-lantern-map" aria-label="Volunteer route preview map">
      <div className="light-lantern-map__top">
        <span><MapPinned size={15} /> VOLUNTEER ROUTE MAP</span>
        <span className={`light-lantern-map__status${mapRunning ? " is-moving" : " is-stopped"}`}>
          {mapRunning ? `Vehicle moving · ${vehicleState.progress}%` : "Arrived at shelter · Simulation stopped"}
        </span>
      </div>
      <div className="light-lantern-map__canvas">
        <svg viewBox="0 0 440 150" role="img" aria-label="Simulated food delivery vehicle moving from kitchen to shelter">
          <path
            className="light-lantern-map__roads"
            d="M-10 115 56 92 94 105 145 63 195 72 240 36 286 50 328 24 455 48M-6 34 52 51 98 37 151 74 190 118 250 111 288 84 346 101 451 73M-10 76 41 70 86 83 126 78 173 91 218 82 264 100 311 72 360 89 450 61"
          />
          <path
            ref={routePathRef}
            className="light-lantern-map__route"
            d="M38 99 97 104 145 63 195 72 240 36 286 50 328 34 390 45"
          />
          <circle cx="38" cy="99" r="5" fill="#e8643c" stroke="#fff" strokeWidth="2" />
          <circle cx="390" cy="45" r="5" fill="#2f5d3a" stroke="#fff" strokeWidth="2" />
        </svg>
        <span className="light-lantern-map__pin light-lantern-map__pin--pickup">KITCHEN</span>
        <span className="light-lantern-map__pin light-lantern-map__pin--dropoff">SHELTER</span>
        <span
          className={`light-lantern-map__vehicle${mapRunning ? " is-running" : " is-stopped"}`}
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform: `translate(-50%, -50%) rotate(${vehicleState.angle * 0.35}deg)`,
          }}
          aria-hidden="true"
        >
          <Truck size={18} />
        </span>
      </div>
      {!mapRunning && (
        <div className="light-lantern-map__footer">
          <span>Route completed at Shelter drop-off.</span>
          <button type="button" onClick={() => setRunCycle((c) => c + 1)}>
            <RotateCcw size={13} /> Replay simulation
          </button>
        </div>
      )}
    </div>
  );
}

export function LightYourLantern({ currentUser, activeRole, openAuthModal }) {
  const toast = useToast();
  const [selectedLantern, setSelectedLantern] = useState(lanterns[0]);
  const [name, setName] = useState(currentUser?.name || "");
  const [certificate, setCertificate] = useState(null);
  const [certPng, setCertPng] = useState("");
  const [badgePng, setBadgePng] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showYellowFlash, setShowYellowFlash] = useState(false);

  const role = currentUser?.role || activeRole || "donor";
  const activeLantern = lanterns.find((item) => item.id === (certificate?.lanternId || selectedLantern.id)) || selectedLantern;

  useEffect(() => {
    setName(currentUser?.name || "");
  }, [currentUser?.name]);

  useEffect(() => {
    if (!certificate) {
      setCertPng("");
      setBadgePng("");
      return;
    }
    setCertPng(renderCertificatePng(certificate));
    setBadgePng(renderBadgePng(certificate));
  }, [certificate]);

  useEffect(() => {
    if (!showYellowFlash) return undefined;
    const timer = window.setTimeout(() => setShowYellowFlash(false), 1100);
    return () => window.clearTimeout(timer);
  }, [showYellowFlash]);

  const lightLantern = async (event) => {
    event.preventDefault();
    setError("");

    if (!currentUser) {
      openAuthModal({ role, tab: "quick" });
      toast.info("Sign in as Donor, Volunteer, or NGO to light your service lantern.");
      return;
    }

    setIsIssuing(true);
    try {
      const issued = await issueServiceCertificate({ name, lanternId: selectedLantern.id });
      setCertificate(issued);
      setShowYellowFlash(true);
      setShowCelebration(true);
      playCelebrationSound();
      toast.success("Congratulations — you lit a lamp!");
    } catch (issueError) {
      setError(issueError.message || "Could not issue the verified certificate.");
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <section id="light-your-lantern" className="light-lantern-section">
      {showYellowFlash && <div className="lantern-yellow-flash" aria-hidden="true" />}

      {showCelebration && certificate && (
        <div className="lantern-celebration-modal" role="dialog" aria-modal="true" aria-label="Lantern celebration">
          <CelebrationBackdrop />
          <div className="lantern-celebration-card">
            <button
              type="button"
              className="lantern-celebration-close"
              onClick={() => setShowCelebration(false)}
              aria-label="Close celebration popup"
            >
              <X size={20} />
            </button>

            <div className="lantern-celebration-hero">
              <span className="lantern-celebration-glow" style={{ "--lantern-color": activeLantern.color }}>
                <LanternIcon color={activeLantern.color} lit size={92} />
              </span>
              <span className="light-lantern-kicker"><Sparkles size={14} /> LANTERN LIT</span>
              <h2>Congratulations, {certificate.name}! You lit a lamp!</h2>
              <p>
                Thank you for serving as a <strong>{roleLabels[certificate.role]}</strong> on FoodBridge. Your E-Certificate and E-Badge images are ready below.
              </p>
            </div>

            <div className="lantern-celebration-images">
              {certPng && (
                <figure className="lantern-img-frame">
                  <img src={certPng} alt={`FoodBridge E-Certificate for ${certificate.name}`} />
                  <figcaption>
                    <button
                      type="button"
                      onClick={() => downloadPngDataUrl(`${certificate.id.toLowerCase()}-certificate.png`, certPng)}
                    >
                      <Download size={15} /> Download E-Certificate (PNG)
                    </button>
                  </figcaption>
                </figure>
              )}
              {badgePng && (
                <figure className="lantern-img-frame lantern-img-frame--badge">
                  <img src={badgePng} alt={`FoodBridge E-Badge for ${certificate.name}`} />
                  <figcaption>
                    <button
                      type="button"
                      onClick={() => downloadPngDataUrl(`${certificate.id.toLowerCase()}-badge.png`, badgePng)}
                    >
                      <Download size={15} /> Download E-Badge (PNG)
                    </button>
                  </figcaption>
                </figure>
              )}
            </div>

            {certificate.role === "volunteer" && (
              <VolunteerRouteSimulationMap certificate={certificate} />
            )}
          </div>
        </div>
      )}

      <div className="light-lantern-shell">
        <div className="light-lantern-heading">
          <span className="light-lantern-kicker"><Sparkles size={15} /> SOCIAL SERVICE RECOGNITION</span>
          <h2>Light Your Lantern</h2>
          <p>
            Donors who made a donation, Volunteers who delivered an order, and NGOs who accepted an order can select a lantern, enter their name, and claim their official FoodBridge E-Certificate &amp; E-Badge images.
          </p>
        </div>

        <div className="light-lantern-grid">
          <div className="light-lantern-picker">
            <div className="light-lantern-cards" role="group" aria-label="Choose a lantern">
              {lanterns.map((lantern) => {
                const isSelected = selectedLantern.id === lantern.id;
                return (
                  <button
                    type="button"
                    key={lantern.id}
                    className={`light-lantern-card${isSelected ? " is-selected" : ""}`}
                    onClick={() => setSelectedLantern(lantern)}
                    aria-pressed={isSelected}
                    style={{ "--lantern-color": lantern.color, "--lantern-glow": lantern.glow }}
                  >
                    <span className="light-lantern-art">
                      <LanternIcon color={lantern.color} lit={isSelected} size={46} />
                    </span>
                    <strong>{lantern.name}</strong>
                    <small>{lantern.message}</small>
                  </button>
                );
              })}
            </div>

            <form className="light-lantern-form" onSubmit={lightLantern}>
              <div className="light-lantern-rolebar">
                <span>
                  <Heart size={14} /> Login Type: <strong>{roleLabels[role] || "Food Donor"}</strong>
                </span>
                <button
                  type="button"
                  className="light-lantern-switch-btn"
                  onClick={() => openAuthModal({ role, tab: "quick" })}
                >
                  {currentUser ? "Switch Account / Role" : "Sign In (Donor / Volunteer / NGO)"}
                </button>
              </div>

              <p className="light-lantern-note">{roleEligibilityNotes[role]}</p>

              <label htmlFor="lantern-participant-name">Your Name on E-Certificate &amp; E-Badge</label>
              <input
                id="lantern-participant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                placeholder={currentUser ? currentUser.name : "Sign in and enter your account name"}
                required
              />

              <div className="light-lantern-identity">
                <span><LockKeyhole size={13} /> Authentic registry verification</span>
                <span>Selected: {selectedLantern.name} Lantern</span>
              </div>

              {error && (
                <div className="light-lantern-error" role="alert">
                  <span>{error}</span>
                  {roleDestinations[role] && (
                    <Link to={roleDestinations[role].to} className="light-lantern-error-link">
                      {roleDestinations[role].label} →
                    </Link>
                  )}
                </div>
              )}

              <button className="light-lantern-submit" type="submit" disabled={isIssuing}>
                <Flame size={17} /> {isIssuing ? "Verifying qualifying service…" : `Light ${selectedLantern.name} Lantern`}
              </button>
            </form>
          </div>

          <div className="light-lantern-result" aria-live="polite">
            {certificate ? (
              <>
                <div className="light-lantern-congrats" style={{ "--lantern-color": activeLantern.color }}>
                  <span className="light-lantern-glow">
                    <LanternIcon color={activeLantern.color} lit size={44} />
                  </span>
                  <div>
                    <span>CONGRATULATIONS</span>
                    <h3>Congratulations, you lit a lamp!</h3>
                  </div>
                  <button
                    type="button"
                    className="light-lantern-switch-btn ml-auto"
                    onClick={() => {
                      setShowYellowFlash(true);
                      setShowCelebration(true);
                      playCelebrationSound();
                    }}
                  >
                    Celebrate Again
                  </button>
                </div>

                <div className="light-lantern-img-grid">
                  {certPng && (
                    <img
                      className="light-lantern-preview-img"
                      src={certPng}
                      alt={`FoodBridge E-Certificate for ${certificate.name}`}
                    />
                  )}
                  {badgePng && (
                    <img
                      className="light-lantern-preview-img light-lantern-preview-img--badge"
                      src={badgePng}
                      alt={`FoodBridge E-Badge for ${certificate.name}`}
                    />
                  )}
                </div>

                <div className="light-lantern-certificate__id">
                  <BadgeCheck size={14} /> {certificate.id}
                </div>

                <div className="light-lantern-downloads">
                  {certPng && (
                    <button
                      type="button"
                      onClick={() => downloadPngDataUrl(`${certificate.id.toLowerCase()}-certificate.png`, certPng)}
                    >
                      <Download size={15} /> E-Certificate (PNG)
                    </button>
                  )}
                  {badgePng && (
                    <button
                      type="button"
                      onClick={() => downloadPngDataUrl(`${certificate.id.toLowerCase()}-badge.png`, badgePng)}
                    >
                      <Download size={15} /> E-Badge (PNG)
                    </button>
                  )}
                  {!certificate.demoMode && (
                    <a href={`/api/certificates/${encodeURIComponent(certificate.id)}`} target="_blank" rel="noreferrer">
                      <ShieldCheck size={15} /> Verify Registry
                    </a>
                  )}
                </div>

                {certificate.role === "volunteer" && (
                  <VolunteerRouteSimulationMap certificate={certificate} />
                )}
              </>
            ) : (
              <div className="light-lantern-promise">
                <span className="light-lantern-glow">
                  <LanternIcon color={selectedLantern.color} lit size={64} />
                </span>
                <h3>A little light travels far.</h3>
                <p>
                  Only verified contributors who donated food (Donor), delivered an order (Volunteer), or accepted an order (NGO) can light a lantern and receive their official FoodBridge E-Certificate &amp; E-Badge PNG images.
                </p>
                <div className="light-lantern-promise__roles">
                  <span>Donor (Donated)</span>
                  <span>Volunteer (Delivered)</span>
                  <span>NGO (Accepted)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
