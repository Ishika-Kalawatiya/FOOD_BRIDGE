import React, { useState } from "react";
import { Bell, Check, Clock3, X } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { useToast } from "./ui/Toast";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const openFeed = () => {
    setOpen((isOpen) => !isOpen);
    if (!open) markAllRead();
  };

  const enableBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      toast.info("Browser notifications are not supported here. In-app alerts will still appear.");
      return;
    }
    if (window.Notification.permission === "granted") {
      toast.info("Browser delivery notifications are already enabled.");
      return;
    }
    const permission = await window.Notification.requestPermission();
    toast.info(permission === "granted"
      ? "Browser delivery notifications enabled."
      : "Browser notifications are blocked. In-app alerts remain enabled.");
  };

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={openFeed}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && <span className="notification-bell__count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-feed" aria-label="Delivery notifications">
          <header className="notification-feed__header">
            <div>
              <strong>Delivery updates</strong>
              <span>{notifications.length ? `${notifications.length} recent updates` : "Your updates will appear here"}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="notification-feed__list">
            {notifications.length ? notifications.map((item) => (
              <article className={`notification-feed__item${item.read ? "" : " is-unread"}`} key={item.id}>
                <span className="notification-feed__check"><Check className="w-3.5 h-3.5" /></span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.createdAt}><Clock3 className="w-3 h-3" />{new Date(item.createdAt).toLocaleString()}</time>
                </div>
              </article>
            )) : (
              <p className="notification-feed__empty">When a rescue order changes stage, you’ll see a timestamped update here.</p>
            )}
          </div>
          <button type="button" className="notification-feed__permission" onClick={enableBrowserNotifications}>
            Enable browser notifications
          </button>
        </section>
      )}
    </div>
  );
}
