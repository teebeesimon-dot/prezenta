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
  label = "Locație",
  value,
  onChange,
  required = false,
  placeholder = "Caută o locație...",
  initialInputValue,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(
    value?.locationName ?? initialInputValue ?? ""
  );
  const [loadError, setLoadError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setInputValue(value?.locationName ?? "");
  }, [value?.locationName, value?.placeId]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsPlaces()
      .then((googleMaps) => {
        if (cancelled || !inputRef.current) return;

        const autocomplete = new googleMaps.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: ["place_id", "formatted_address", "name", "geometry"],
          }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          if (!place.place_id || lat == null || lng == null) {
            onChange(null);
            return;
          }

          const locationName =
            place.formatted_address ?? place.name ?? inputRef.current?.value ?? "";

          setInputValue(locationName);
          onChange({
            placeId: place.place_id,
            locationName,
            latitude: lat,
            longitude: lng,
          });
        });

        autocompleteRef.current = autocomplete;
        setIsReady(true);
        setLoadError("");
      })
      .catch((error: Error) => {
        console.error("GOOGLE MAPS ERROR:", error);
        if (!cancelled) setLoadError(error.message);
      });

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [onChange]);

  function handleInputChange(nextValue: string) {
    setInputValue(nextValue);
    if (value && nextValue.trim() !== value.locationName.trim()) {
      onChange(null);
    }
  }

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        required={required}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete="off"
      />
      {!isReady && !loadError && (
        <p className="mt-1.5 text-xs text-muted-foreground">Se încarcă căutarea locațiilor...</p>
      )}
      {loadError && (
        <p className="mt-1.5 text-xs text-destructive">
          Google Maps indisponibil. Adaugă NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </p>
      )}
      {isReady && !value && inputValue.trim() && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Select a location from the suggestions.
        </p>
      )}
    </div>
  );
}
