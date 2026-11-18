"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

export function AtlasCar({ paused }: { paused: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLImageElement>(null);
  const playback = useRef<() => void>(() => {});
  const pauseRequested = useRef(paused);

  useLayoutEffect(() => {
    pauseRequested.current = paused;
    playback.current();
  }, [paused]);

  useLayoutEffect(() => {
    const lane = track.current;
    const car = sprite.current;
    const spread = lane?.parentElement;
    const cover = spread?.querySelector<HTMLElement>(".atlas-cover");
    const sheet = spread?.querySelector<HTMLElement>(".atlas-sheet");
    if (!lane || !car || !spread || !cover || !sheet) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let drive: Animation | undefined;
    let inView = true;
    function updatePlayback() {
      if (!drive) return;
      if (pauseRequested.current || reduced.matches || document.hidden || !inView) drive.pause();
      else drive.play();
    }
    playback.current = updatePlayback;

    function measure() {
      if (!lane || !car || !cover || !sheet) return;
      const progress = drive?.effect?.getComputedTiming().progress ?? .08;
      drive?.cancel();
      drive = undefined;
      const width = lane.clientWidth;
      const coverBottom = cover.offsetTop + cover.offsetHeight;
      let size: number;
      let path: string;
      let length: number;
      if (sheet.offsetTop >= coverBottom) {
        // On stacked layouts the horizontal gap separates both content boxes.
        const gap = sheet.offsetTop - coverBottom;
        const y = coverBottom + gap / 2;
        size = Math.min(60, (gap - 10) * 2);
        path = `M ${-size} ${y} H ${width + size}`;
        length = width + size * 2;
      } else {
        const coverRight = cover.offsetLeft + cover.offsetWidth;
        const gap = sheet.offsetLeft - coverRight;
        const x = coverRight + gap / 2;
        const headroom = Math.min(cover.offsetTop, sheet.offsetTop);
        const contentEnd = Math.max(coverBottom, sheet.offsetTop + sheet.offsetHeight);
        const footroom = lane.clientHeight - contentEnd;
        const top = headroom / 2;
        const bottom = contentEnd + (footroom + 5) / 2;
        // Allow for the rotating silhouette in the gutter and the sheet's shadow.
        size = Math.min(66, gap * .74, 2 * (headroom - 10), 2 * (footroom - 12));
        const r = Math.min(9, gap * .06);
        path = `M ${-size} ${top} H ${x - r} Q ${x} ${top} ${x} ${top + r} V ${bottom - r} Q ${x} ${bottom} ${x + r} ${bottom} H ${width + size}`;
        length = width + size * 2 + bottom - top;
      }
      car.style.visibility = "hidden";
      if (size < 18 || !CSS.supports("offset-path", 'path("M 0 0 H 1")')) return;
      car.style.width = size + "px";
      car.style.offsetPath = 'path("' + path + '")';
      car.style.visibility = "visible";
      const duration = Math.max(5500, length / 90 * 1000);
      drive = car.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], {
        duration, iterations: Infinity, easing: "linear",
      });
      drive.currentTime = (reduced.matches ? .15 : progress) * duration;
      updatePlayback();
    }
    measure();
    const resize = new ResizeObserver(measure);
    [spread, cover, sheet].forEach((element) => resize.observe(element));
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    visibility.observe(lane);
    reduced.addEventListener("change", measure);
    document.addEventListener("visibilitychange", updatePlayback);
    return () => {
      resize.disconnect();
      visibility.disconnect();
      reduced.removeEventListener("change", measure);
      document.removeEventListener("visibilitychange", updatePlayback);
      drive?.cancel();
      playback.current = () => {};
    };
  }, []);

  return <div ref={track} className="atlas-car-track" aria-hidden="true">
    <Image ref={sprite} className="atlas-car" src="/atlas-coupe.webp" alt="" width={288} height={144} unoptimized draggable={false} />
  </div>;
}
