import { useCallback, useEffect, useState } from 'react';
import type { MarketLocation } from '@/lib/marketIntelligenceApi';

const REVERSE_GEO_URL = 'https://nominatim.openstreetmap.org/reverse';

export function useMarketLocation() {
  const [location, setLocation] = useState<MarketLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<{ state: string; district: string }> => {
    try {
      const res = await fetch(
        `${REVERSE_GEO_URL}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) throw new Error('Geocode failed');
      const data = await res.json();
      const addr = data.address || {};
      const state = addr.state || addr.region || 'Maharashtra';
      const district = addr.state_district || addr.county || addr.city || state;
      return { state, district };
    } catch {
      return { state: 'Maharashtra', district: 'Pune' };
    }
  }, []);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setPermissionDenied(true);
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geo = await reverseGeocode(latitude, longitude);
        setLocation({ latitude, longitude, state: geo.state, district: geo.district, source: 'gps' });
        setLoading(false);
      },
      () => {
        setPermissionDenied(true);
        setError('Location permission denied. Select state and district manually.');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [reverseGeocode]);

  const setManualLocation = useCallback((state: string, district: string) => {
    setLocation({ latitude: 19.0, longitude: 72.8, state, district, source: 'manual' });
    setPermissionDenied(false);
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, loading, error, permissionDenied, requestLocation, setManualLocation };
}
