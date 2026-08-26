"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

interface PrivateCardImageProps {
  pathname: string;
  alt: string;
  className?: string;
}

export default function PrivateCardImage({ pathname, alt, className }: PrivateCardImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch(`/api/player-card-image?pathname=${encodeURIComponent(pathname)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setSrc(objectUrl);
    }
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pathname]);

  if (!src) return <div className={`${className ?? ""} animate-pulse bg-muted`} aria-label={`Se încarcă ${alt}`} />;
  return <img src={src} alt={alt} className={className} />;
}
