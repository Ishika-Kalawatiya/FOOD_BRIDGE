import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/ui/Toast";
import { fetchVolunteerAlerts } from "../services/api";

const NotificationContext = createContext(null);

function readNotifications(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function formatVolunteerAlert(alert) {
  const qty = `${Number(alert.meals || 0)} servings`;
  const pickup = alert.pickupAddress || "Pickup location";
  const dropoff = alert.dropoffAddress || "Drop-off location";
  const extra = [
    alert.donorName ? `Donor: ${alert.donorName}` : "",
    alert.ngoOrg ? `NGO: ${alert.ngoOrg}` : "",
    alert.expiresAt ? `Pickup by ${new Date(alert.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "",
    alert.notes ? `Notes: ${alert.notes}` : "",
  ].filter(Boolean).join(" · ");

  return {
    id: alert.id,
    listingId: alert.listingId,
    title: `Volunteer Needed: ${alert.title} (${qty})`,
    message: `Pickup: ${pickup} → Drop-off: ${dropoff}${extra ? ` · ${extra}` : ""}`,
    createdAt: alert.createdAt || new Date().toISOString(),
  };
}

export function NotificationProvider({ children }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  const storageKey = currentUser ? `fb_notifications_${currentUser.id}` : null;
  const [notifications, setNotifications] = useState([]);

  toastRef.current = toast;

  useEffect(() => {
    setNotifications(storageKey ? readNotifications(storageKey) : []);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {
      toastRef.current.error("Could not save your notification history on this device.");
    }
  }, [notifications, storageKey]);

  const addNotification = useCallback((notification) => {
    if (!storageKey) return;
    const entry = {
      ...notification,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: false,
    };
    setNotifications((previous) => {
      if (previous.some((item) => item.id === entry.id)) return previous;
      toastRef.current.info(entry.message, 7000);
      if ("Notification" in window && window.Notification.permission === "granted") {
        new window.Notification(entry.title || "FoodBridge delivery update", {
          body: entry.message,
          tag: entry.id,
        });
      }
      return [entry, ...previous].slice(0, 60);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return undefined;
    const syncVolunteerBroadcasts = () => {
      if (currentUser?.role !== "volunteer") return;
      try {
        const localBroadcasts = JSON.parse(localStorage.getItem("fb_volunteer_broadcasts") || "[]");
        if (Array.isArray(localBroadcasts)) {
          localBroadcasts.forEach((alert) => addNotification(formatVolunteerAlert(alert)));
        }
      } catch (_e) {}
      fetchVolunteerAlerts()
        .then((alerts) => {
          alerts.forEach((alert) => addNotification(formatVolunteerAlert(alert)));
        })
        .catch(() => {});
    };

    syncVolunteerBroadcasts();
    const handleStorage = (event) => {
      if (event.key === storageKey) {
        setNotifications(readNotifications(storageKey));
      }
      if (event.key === "fb_volunteer_broadcasts") {
        syncVolunteerBroadcasts();
      }
    };
    const handleBroadcastEvent = (event) => {
      if (currentUser?.role === "volunteer" && event.detail) {
        addNotification(formatVolunteerAlert(event.detail));
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("foodbridge:volunteer-broadcast", handleBroadcastEvent);
    const interval = currentUser?.role === "volunteer"
      ? window.setInterval(syncVolunteerBroadcasts, 12000)
      : null;

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("foodbridge:volunteer-broadcast", handleBroadcastEvent);
      if (interval) window.clearInterval(interval);
    };
  }, [storageKey, currentUser?.role, addNotification]);

  const markAllRead = useCallback(() => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
  }, []);

  const unreadCount = notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0);
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
  }), [notifications, unreadCount, addNotification, markAllRead]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
