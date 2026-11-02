import { env } from "@/lib/env";

type GoogleMapsWindow = Window & {
  google?: typeof google;
};

let loadPromise: Promise<typeof google> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  return env.googleMapsApiKey;
}

export function loadGoogleMapsPlaces(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps poate fi incarcat doar in browser."));
  }

  const mapsWindow = window as GoogleMapsWindow;
  const existingMaps = mapsWindow.google?.maps;

  if (existingMaps && typeof existingMaps.importLibrary === "function") {
    return existingMaps.importLibrary("places").then(() => mapsWindow.google!);
  }

  if (loadPromise) return loadPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error("Lipseste NEXT_PUBLIC_GOOGLE_MAPS_API_KEY din configuratia aplicatiei.")
    );
  }

  const googleObject = (mapsWindow.google ??= {} as typeof google);
  const mapsObject = (googleObject.maps ??= {} as typeof google.maps);

  // Google-recommended dynamic-library bootstrap. The API replaces this
  // temporary importLibrary function after its script has loaded.
  const mapsRecord = mapsObject as unknown as Record<string, unknown>;
  const requestedLibraries = new Set<string>();
  let bootstrapPromise: Promise<void> | null = null;

  const importLibrary = ((libraryName: string, ...args: unknown[]) => {
    requestedLibraries.add(libraryName);
    bootstrapPromise ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const params = new URLSearchParams();
      params.set("key", apiKey);
      params.set("v", "weekly");
      params.set("callback", "google.maps.__ib__");
      params.set("libraries", [...requestedLibraries].join(","));
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.onerror = () => {
        script.remove();
        bootstrapPromise = null;
        loadPromise = null;
        reject(
          new Error(
            "Nu s-a putut incarca Google Maps. Verifica cheia API, restrictiile de domeniu si activarea Maps JavaScript API in Google Cloud."
          )
        );
      };
      mapsRecord.__ib__ = resolve;
      document.head.appendChild(script);
    });

    return bootstrapPromise.then(() => {
      const loadedImportLibrary = mapsObject.importLibrary as unknown as (
        name: string,
        ...parameters: unknown[]
      ) => Promise<unknown>;
      if (loadedImportLibrary === importLibrary) {
        throw new Error("Google Maps nu a initializat functia importLibrary.");
      }
      return loadedImportLibrary(libraryName, ...args);
    });
  }) as typeof google.maps.importLibrary;

  mapsObject.importLibrary = importLibrary;

  loadPromise = importLibrary("places")
    .then(() => googleObject)
    .catch((error: unknown) => {
      loadPromise = null;
      throw error instanceof Error
        ? error
        : new Error("Eroare la incarcarea bibliotecii Google Maps Places.");
    });

  return loadPromise;
}
