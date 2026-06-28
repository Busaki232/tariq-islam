import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface GeolocationCoords {
  latitude: number;
  longitude: number;
}

interface UseGeolocationReturn {
  coords: GeolocationCoords | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => Promise<void>;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [coords, setCoords] = useState<GeolocationCoords | null>(() => {
    // Check localStorage for saved location
    const saved = localStorage.getItem('user-location');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check permission status first
      const permission = await navigator.permissions.query({ name: 'geolocation' });

      if (permission.state === 'denied') {
        setError('Location permission denied. Please enable location access in your browser settings.');
        setLoading(false);
        return;
      }

      // Request current position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCoords(newCoords);
          localStorage.setItem('user-location', JSON.stringify(newCoords));
          setLoading(false);
        },
        (error) => {
          logger.error('Geolocation error', error);
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access and try again.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please try again.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = `Location error: ${error.message}`;
          }
          
          setError(errorMessage);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // Increased timeout
          maximumAge: 300000, // 5 minutes
        }
      );
    } catch (err) {
      logger.error('Permission check failed', err);
      // Fallback to direct geolocation request
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCoords(newCoords);
          localStorage.setItem('user-location', JSON.stringify(newCoords));
          setLoading(false);
        },
        (error) => {
          logger.error('Geolocation error (fallback)', error);
          setError(`Failed to get location: ${error.message}`);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  };

  // Removed auto-request - let components decide when to request location

  return { coords, error, loading, requestLocation };
};