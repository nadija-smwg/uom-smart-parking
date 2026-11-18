"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/** Animate the current contents once, including after a deliberate view change. */
export function useParkingMotion<T extends HTMLElement>(selector: string, view = "", onView = false) {
  const root = useRef<T>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const targets = element.querySelectorAll(selector);
      if (!targets.length) return;
      const reveal = gsap.fromTo(targets, { y: 12, opacity: 0.45 }, {
        y: 0, opacity: 1, duration: 0.46, ease: "power3.out",
        stagger: { amount: Math.min(0.32, (targets.length - 1) * 0.055) },
        paused: true, immediateRender: false, clearProps: "transform,opacity",
      });
      if (!onView) {
        reveal.play();
        return;
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          reveal.play();
          observer.disconnect();
        }
      });
      observer.observe(element);
      return () => observer.disconnect();
    });
    return () => media.revert();
  }, [selector, view, onView]);
  return root;
}
