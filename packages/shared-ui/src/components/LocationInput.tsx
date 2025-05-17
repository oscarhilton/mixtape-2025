"use client";

import React, { useState, useEffect } from "react";

interface Location {
  latitude: number | null;
  longitude: number | null;
  address?: string;
}

interface LocationInputProps {
  onLocationChange: (location: Location) => void;
  initialLocation?: Location;
}

export function LocationInput({
  onLocationChange,
  initialLocation,
}: LocationInputProps) {
  const [locationMethod, setLocationMethod] = useState<"automatic" | "manual">(
    "automatic",
  );
  const [address, setAddress] = useState(initialLocation?.address || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location>(
    initialLocation || { latitude: null, longitude: null },
  );

  useEffect(() => {
    if (locationMethod === "automatic") {
      getCurrentLocation();
    }
  }, [locationMethod]);

  const getCurrentLocation = () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        onLocationChange({ latitude, longitude });

        // Try to get address from coordinates
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          );
          const data = await response.json();
          if (data.display_name) {
            setAddress(data.display_name);
            setLocation((prev) => ({ ...prev, address: data.display_name }));
            onLocationChange({
              latitude,
              longitude,
              address: data.display_name,
            });
          }
        } catch (err) {
          console.error("Error fetching address:", err);
        }

        setIsLoading(false);
      },
      (error) => {
        setError("Unable to retrieve your location. Please try manual entry.");
        setIsLoading(false);
      },
    );
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newLocation = {
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          address: display_name,
        };
        setLocation(newLocation);
        onLocationChange(newLocation);
        setAddress(display_name);
      } else {
        setError("Address not found. Please try a different address.");
      }
    } catch (err) {
      setError("Error looking up address. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => setLocationMethod("automatic")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
            ${
              locationMethod === "automatic"
                ? "bg-spotify-green text-black"
                : "bg-spotify-gray hover:bg-spotify-light-gray"
            }`}
        >
          <span className="text-lg">📍</span>
          <span>Use Current Location</span>
        </button>
        <button
          type="button"
          onClick={() => setLocationMethod("manual")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
            ${
              locationMethod === "manual"
                ? "bg-spotify-green text-black"
                : "bg-spotify-gray hover:bg-spotify-light-gray"
            }`}
        >
          <span className="text-lg">🌍</span>
          <span>Enter Address</span>
        </button>
      </div>

      {locationMethod === "manual" && (
        <form onSubmit={handleAddressSubmit} className="space-y-4">
          <div>
            <label htmlFor="address" className="block text-sm font-medium mb-1">
              Enter Address
            </label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter a location or address"
              className="w-full px-3 py-2 bg-spotify-dark border border-spotify-gray rounded-md placeholder-spotify-light-gray
                focus:outline-none focus:ring-2 focus:ring-spotify-green focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-spotify-green text-black rounded-md font-medium
              hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Looking up address..." : "Look Up Address"}
          </button>
        </form>
      )}

      {isLoading && (
        <div className="text-center text-spotify-light-gray">
          {locationMethod === "automatic"
            ? "Getting your location..."
            : "Looking up address..."}
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {location.latitude && location.longitude && (
        <div className="text-spotify-light-gray text-sm">
          <p>Selected Location:</p>
          <p>Latitude: {location.latitude.toFixed(6)}</p>
          <p>Longitude: {location.longitude.toFixed(6)}</p>
          {location.address && <p>Address: {location.address}</p>}
        </div>
      )}
    </div>
  );
}
