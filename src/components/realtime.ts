"use client";

import { useEffect, useRef } from "react";
import { browserAuth } from "@/lib/supabase-browser";

export function useParkingUpdates(refresh: () => void, setOnline: (online: boolean) => void) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    const supa = browserAuth();
    let channel: ReturnType<typeof supa.channel> | undefined;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribed = false;
    let lastPoll = Date.now();
    const schedule = () => {
      if (closed || timer || !navigator.onLine || document.hidden) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!closed && navigator.onLine && !document.hidden) callback.current();
      }, 300);
    };
    const network = () => {
      setOnline(navigator.onLine);
      schedule();
    };
    void supa.auth.getSession().then(async ({ data }) => {
      if (closed || !data.session) return;
      await supa.realtime.setAuth();
      if (closed) return;
      channel = supa.channel("parking-campus", { config: { private: true } })
        .on("broadcast", { event: "parking.changed" }, schedule)
        .subscribe((status) => { subscribed = status === "SUBSCRIBED"; schedule(); });
    }).catch(() => { subscribed = false; });
    const poll = setInterval(() => {
      if (!document.hidden && Date.now() - lastPoll >= (subscribed ? 60_000 : 15_000)) {
        lastPoll = Date.now();
        schedule();
      }
    }, 5000);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    network();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (channel) void supa.removeChannel(channel);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [setOnline]);
}
