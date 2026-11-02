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
  if (
    mapsWindow.google?.maps &&
    typeof mapsWindow.google.maps.importLibrary === "function"
  ) {
    return Promise.resolve(mapsWindow.google);
  }

  if (loadPromise) return loadPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error("Lipseste NEXT_PUBLIC_GOOGLE_MAPS_API_KEY din configuratia aplicatiei.")
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const googleObject = (mapsWindow.google ??= {} as typeof google);
    const mapsObject = (googleObject.maps ??= {} as typeof google.maps);

    // Official Google Maps JS API bootstrap: it defines importLibrary before
    // loading the API and safely supports libraries requested by the app.
    const mapsRecord = mapsObject as unknown as Record<string, unknown>;
    const libraries = new Set<string>();
    let scriptPromise: Promise<void> | null = null;

    const loadApi = () => {
      if (!scriptPromise) {
        scriptPromise = new Promise<void>((resolveScript, rejectScript) => {
          const script = document.createElement("script");
          const params = new URLSearchParams({
            key: apiKey,
            v: "weekly",
            callback: "google.maps.__ib__",
          });
          params.set("loading", "async");
          params.set("libraries", [...libraries].join(","));
          script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
          script.async = true;
          script.onerror = () => {
            script.remove();
            scriptPromise = null;
            rejectScript(
              new Error(
                "Nu s-a putut incarca Google Maps. Verifica cheia API, restrictiile de domeniu si activarea Maps JavaScript API in Google Cloud."
              )
            );
          };
          mapsRecord.__ib__ = () => resolveScript();
          document.head.appendChild(script);
        });
      }
      return scriptPromise;
    };

    mapsObject.importLibrary = ((libraryName: string) => {
      libraries.add(libraryName);
      return loadApi().then(() => {
        const library = (mapsObject as unknown as Record<string, unknown>)[libraryName];
        if (library) return library;
        throw new Error(`Google Maps nu a returnat biblioteca "${libraryName}".`);
      });
    }) as typeof google.maps.importLibrary;

    mapsObject.importLibrary("places")
      .then(() => resolve(googleObject))
      .catch((error: unknown) => {
        loadPromise = null;
        reject(error instanceof Error ? error : new Error("Eroare la incarcarea Google Maps."));
      });
  });

  return loadPromise;
}
