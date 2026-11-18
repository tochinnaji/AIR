"use client";

import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import MoonIcon from "@/components/ui/moon-icon";

const themeKey = "forme-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(themeKey) === "dark";
    setDark(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "light";
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(themeKey, next ? "dark" : "light");
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };

  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>
    <span aria-hidden="true">{dark ? <Sun size={21} strokeWidth={1.9}/> : <MoonIcon size={22}/>}</span>
    <span className="theme-toggle-label">{dark ? "Light" : "Dark"}</span>
  </button>;
}
