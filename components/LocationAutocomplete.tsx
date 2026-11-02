"use client";

import { useEffect, useRef, useState } from "react";
import { inputClassName, labelClassName } from "@/lib/event-form";
import { loadGoogleMapsPlaces } from "@/lib/google-maps";
import type { EventLocation } from "@/lib/location";

interface LocationAutocompleteProps {
  id?: string;
  label?: string;
  value: EventLocation | null;
  onChange: (value: EventLocation | null) => void;
  required?: boolean;
  placeholder?: string;
  /** Shown when value is null (e.g. legacy events with only a text location). */
  initialInputValue?: string;
}

export default function LocationAutocomplete({
  id = "location",
  label = "Locatie",
  value,
  onChange,
  required = false,
  placeholder = "Cauta o locatie...",
  initialInputValue,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const placesRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);

  const [inputValue, setInputValue] = useState(
    value?.locationName ?? initialInputValue ?? ""
  );
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [loadError, setLoadError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (value?.locationName) {
      setInputValue(value.locationName);
    }
  }, [value?.locationName, value?.placeId]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsPlaces()
      .then(async (googleMaps) => {
        const places = (await googleMaps.maps.importLibrary(
          "places"
        )) as google.maps.PlacesLibrary;

        if (cancelled) return;
        placesRef.current = places;
        setIsReady(true);
        setLoadError("");
      })
      .catch((error: unknown) => {
        console.error("Google Maps initialization failed:", error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "A aparut o eroare la initializarea Google Maps."
          );
        }
      });

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const query = inputValue.trim();
    const places = placesRef.current;

    if (!isReady || !places || query.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setLoadError("");

      try {
        const sessionToken =
          sessionTokenRef.current ?? new places.AutocompleteSessionToken();
        sessionTokenRef.current = sessionToken;

        const response =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken,
            includedRegionCodes: ["RO"],
            language: "ro",
            region: "ro",
          });

        if (currentRequestId !== requestIdRef.current) return;

        setSuggestions(
          response.suggestions.filter((item) => item.placePrediction != null)
        );
      } catch (error: unknown) {
        console.error("Google Places autocomplete failed:", error);
        if (currentRequestId === requestIdRef.current) {
          setSuggestions([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Nu am putut cauta locatia. Verifica setarile Google Maps API."
          );
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inputValue, isReady]);

  async function handleSelect(
    suggestion: google.maps.places.AutocompleteSuggestion
  ) {
    const prediction = suggestion.placePrediction;
    if (!prediction || !placesRef.current) return;

    setIsSelecting(true);
    setLoadError("");

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["id", "formattedAddress", "displayName", "location"],
      });

      const latitude = place.location?.lat();
      const longitude = place.location?.lng();

      if (!place.id || latitude == null || longitude == null) {
        throw new Error("Google nu a returnat coordonatele pentru aceasta locatie.");
      }

      const locationName =
        place.formattedAddress ??
        place.displayName ??
        prediction.text.toString();

      const selectedLocation: EventLocation = {
        placeId: place.id,
        locationName,
        latitude,
        longitude,
      };

      setInputValue(locationName);
      setSuggestions([]);
      sessionTokenRef.current = null;
      onChangeRef.current(selectedLocation);
    } catch (error: unknown) {
      console.error("Google Place details failed:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Nu am putut prelua detaliile locatiei selectate."
      );
    } finally {
      setIsSelecting(false);
    }
  }

  function handleInputChange(nextValue: string) {
    setInputValue(nextValue);
    setLoadError("");

    if (value && nextValue.trim() !== value.locationName.trim()) {
      onChangeRef.current(null);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        required={required}
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => {
          if (inputValue.trim().length >= 3 && suggestions.length > 0) {
            setSuggestions(suggestions);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setSuggestions([]), 150);
        }}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
        aria-busy={isSearching || isSelecting}
      />

      {suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {suggestions.map((suggestion, index) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;

            return (
              <li key={`${prediction.placeId}-${index}`} role="option" aria-selected="false">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleSelect(suggestion)}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
                >
                  {prediction.text.toString()}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isReady && !loadError && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Se incarca cautarea locatiilor...
        </p>
      )}
      {isReady && isSearching && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Se cauta locatii...
        </p>
      )}
      {isSelecting && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Se preiau detaliile locatiei...
        </p>
      )}
      {loadError && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          Eroare Google Maps: {loadError}
        </p>
      )}
      {isReady && !loadError && inputValue.trim().length > 0 && inputValue.trim().length < 3 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Introdu cel putin 3 caractere pentru cautare.
        </p>
      )}
      {isReady && !value && inputValue.trim().length >= 3 && !isSearching && suggestions.length === 0 && !loadError && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Nu am gasit sugestii. Incearca o alta cautare.
        </p>
      )}
    </div>
  );
}
