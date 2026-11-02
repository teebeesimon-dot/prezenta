declare global {
  interface Window {
    google?: typeof google;
  }
}

import { env } from "@/lib/env";

let loadPromise: Promise<typeof google> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  return env.googleMapsApiKey;
}

export function loadGoogleMapsPlaces(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps poate fi incarcat doar in browser."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error("Lipseste NEXT_PUBLIC_GOOGLE_MAPS_API_KEY din configuratia aplicatiei.")
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("https://maps.googleapis.com/maps/api/js").toString();
    const url = new URL(script.src);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("loading", "async");
    url.searchParams.set("v", "weekly");
    script.src = url.toString();
    script.async = true;
    script.defer = true;

    const fail = (error: Error) => {
      script.remove();
      loadPromise = null;
      reject(error);
    };

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        fail(new Error("Google Maps s-a incarcat, dar biblioteca Maps nu este disponibila."));
      }
    };

    script.onerror = () => {
      fail(
        new Error(
          "Nu s-a putut incarca Google Maps. Verifica cheia API, restrictiile de domeniu si activarea Maps JavaScript API in Google Cloud."
        )
      );
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
