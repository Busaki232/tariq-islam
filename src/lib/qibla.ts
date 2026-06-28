// Qibla direction calculation utilities
// Kaaba coordinates (Mecca, Saudi Arabia)
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

/**
 * Calculate the Qibla direction (bearing) from a given location to Mecca
 * @param userLat - User's latitude
 * @param userLng - User's longitude
 * @returns Bearing in degrees (0-360)
 */
export const calculateQiblaBearing = (userLat: number, userLng: number): number => {
  // Convert degrees to radians
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const toDegrees = (radians: number) => radians * (180 / Math.PI);

  const lat1 = toRadians(userLat);
  const lat2 = toRadians(KAABA_LAT);
  const deltaLng = toRadians(KAABA_LNG - userLng);

  const x = Math.sin(deltaLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  let bearing = toDegrees(Math.atan2(x, y));
  
  // Normalize to 0-360 degrees
  bearing = (bearing + 360) % 360;
  
  return Math.round(bearing);
};

/**
 * Get compass direction name from bearing
 * @param bearing - Bearing in degrees
 * @returns Compass direction (e.g., "NE", "SSW")
 */
export const getCompassDirection = (bearing: number): string => {
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];
  
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
};

/**
 * Get multiple Qibla finder service URLs
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Array of service URLs with names
 */
export const getQiblaServices = (lat: number, lng: number) => [
  {
    name: "QiblaFind.net",
    url: `https://qiblafind.net/?lat=${lat}&lng=${lng}`,
  },
  {
    name: "IslamicFinder",
    url: `https://www.islamicfinder.org/qibla-direction/?latitude=${lat}&longitude=${lng}`,
  },
  {
    name: "Qibla Compass",
    url: `https://qiblacompass.com/?lat=${lat}&lng=${lng}`,
  }
];

/**
 * Try to open Qibla finder with fallbacks
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise that resolves when a service opens successfully
 */
export const openQiblaFinder = async (lat: number, lng: number): Promise<{ success: boolean; service?: string; bearing?: number; popupBlocked?: boolean }> => {
  const services = getQiblaServices(lat, lng);
  const bearing = calculateQiblaBearing(lat, lng);
  
  // Try each service
  for (const service of services) {
    try {
      const popup = window.open(service.url, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (popup) {
        // Check if popup was blocked after a short delay
        setTimeout(() => {
          try {
            if (!popup.closed) {
              return { success: true, service: service.name, bearing };
            }
          } catch (e) {
            // Silently handle popup status check errors
          }
        }, 100);
        
        return { success: true, service: service.name, bearing };
      }
    } catch (error) {
      continue;
    }
  }
  
  return { success: false, bearing, popupBlocked: true };
};

/**
 * Format bearing for display with more descriptive direction
 * @param bearing - Bearing in degrees
 * @returns Formatted string with bearing and direction
 */
export const formatQiblaDirection = (bearing: number): string => {
  const direction = getCompassDirection(bearing);
  return `${bearing}° ${direction}`;
};