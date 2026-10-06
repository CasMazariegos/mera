/** A tiny hash router: a handful of screens, deep-linkable, works offline and on any static host. */
import { useSyncExternalStore } from "react";

export const ROUTES = ["/", "/daily", "/check-in", "/patterns", "/journal", "/settings", "/about", "/welcome", "/start"] as const;
export type Route = (typeof ROUTES)[number];

function current(): Route {
  const h = (typeof location === "undefined" ? "" : location.hash.replace(/^#/, "")) || "/";
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : "/";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => "/" as Route);
}

export function navigate(to: Route) {
  if (current() === to) return;
  location.hash = to === "/" ? "" : to;
  if (to === "/") history.replaceState(null, "", location.pathname + location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function href(to: Route): string {
  return to === "/" ? "#" : `#${to}`;
}
