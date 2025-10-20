// Fixed radius for all company locations (in meters)
const FIXED_RADIUS = 60;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in meters
 */
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371e3; // Earth's radius in meters
//   const φ1 = (lat1 * Math.PI) / 180;
//   const φ2 = (lat2 * Math.PI) / 180;
//   const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//   const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//   const a =
//     Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//     Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c; // Distance in meters
// }

const calculateDistance = (
  ispLat,
  ispLon,
  userLat,
  userLon,
  unit = 'm'
) => {
  const p = 0.017453292519943295;
  const a =
    0.5 -
    Math.cos((userLat - ispLat) * p) / 2 +
    (Math.cos(ispLat * p) *
      Math.cos(userLat * p) *
      (1 - Math.cos((userLon - ispLon) * p))) /
      2;
  
  const distanceInKm = 12742 * Math.asin(Math.sqrt(a));
  
  if (unit === 'm') {
    return Math.ceil(distanceInKm * 1000); // Convert to meters
  }
  
  return Math.ceil(distanceInKm); // Return in kilometers
};

/**
 * Check if coordinates are within allowed radius of any company location
 * Uses dynamic radius based on device type for better Android compatibility
 * @param {number} userLat - User's latitude
 * @param {number} userLng - User's longitude
 * @param {Array} companyLocations - Array of company location objects
 * @param {string} userAgent - User agent string to detect device type
 * @returns {Object} Validation result with location info
 */
function validateLocation(userLat, userLng, companyLocations, userAgent = "") {
  if (!companyLocations || companyLocations.length === 0) {
    return {
      valid: false,
      message: "No company locations configured",
      location: null,
    };
  }

  // Dynamic radius: Android gets more lenient radius due to GPS accuracy issues
  const radius = userAgent.includes("Android") ? 110 : FIXED_RADIUS;

  // Check against all active locations
  for (const location of companyLocations) {
    if (!location.isActive) continue;

    const distance = calculateDistance(
      userLat,
      userLng,
      location.latitude,
      location.longitude
    );

    if (distance <= radius) {
      return {
        valid: true,
        message: `Check-in allowed at ${location.name}`,
        location: location,
        distance: Math.round(distance),
        radius: radius, // Include which radius was used
        deviceType: userAgent.includes("Android") ? "Android" : "iOS/Other",
      };
    }
  }

  return {
    valid: false,
    message: "Not within allowed company locations",
    location: null,
    radius: radius, // Include which radius was used for debugging
  };
}

/**
 * Format coordinates for display
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} Formatted coordinates
 */
function formatCoordinates(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Validate coordinate format and range
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Object} Validation result
 */
function validateCoordinates(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return {
      valid: false,
      message: "Coordinates must be numbers",
    };
  }

  if (latitude < -90 || latitude > 90) {
    return {
      valid: false,
      message: "Latitude must be between -90 and 90",
    };
  }

  if (longitude < -180 || longitude > 180) {
    return {
      valid: false,
      message: "Longitude must be between -180 and 180",
    };
  }

  return {
    valid: true,
    message: "Coordinates are valid",
  };
}

export default {
  calculateDistance,
  validateLocation,
  formatCoordinates,
  validateCoordinates,
};
