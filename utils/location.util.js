// Fixed radius for all company locations (in meters)
const FIXED_RADIUS = 10;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if coordinates are within allowed radius of any company location
 * Uses a fixed 40-meter radius for all company locations
 * @param {number} userLat - User's latitude
 * @param {number} userLng - User's longitude
 * @param {Array} companyLocations - Array of company location objects
 * @returns {Object} Validation result with location info
 */
function validateLocation(userLat, userLng, companyLocations) {
  if (!companyLocations || companyLocations.length === 0) {
    return {
      valid: false,
      message: "No company locations configured",
      location: null,
    };
  }

  // Check against all active locations
  for (const location of companyLocations) {
    if (!location.isActive) continue;

    const distance = calculateDistance(
      userLat,
      userLng,
      location.latitude,
      location.longitude
    );

    if (distance <= FIXED_RADIUS) {
      return {
        valid: true,
        message: `Check-in allowed at ${location.name}`,
        location: location,
        distance: Math.round(distance),
      };
    }
  }

  return {
    valid: false,
    message: "Not within allowed company locations",
    location: null,
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
