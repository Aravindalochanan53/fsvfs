export function requestFreshPosition(geolocation = globalThis.navigator?.geolocation) {
  if (!geolocation) return Promise.reject(new Error("This browser does not support location access."));
  return new Promise((resolve, reject) => {
    const fail = (error) => reject(new Error(error.code === 1
      ? "Location permission denied. Allow location for this site and enable device Location services, then retry."
      : error.code === 3
        ? "Location timed out. Enable device Location services and Wi-Fi, move near a window, then refresh GPS."
        : "Your device cannot determine its location. Check location services and browser permission, then retry."));
    const success = (position) => {
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy <= 0) {
        reject(new Error("The device returned an invalid location. Refresh GPS and retry."));
      } else if (!Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 60000) {
        reject(new Error("The location reading is stale. Refresh GPS to get your current position."));
      } else {
        resolve({ lat, lng, accuracy, timestamp: position.timestamp });
      }
    };
    geolocation.getCurrentPosition(success, (error) => {
      if (error.code === 1) return fail(error);
      geolocation.getCurrentPosition(success, fail, { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}
