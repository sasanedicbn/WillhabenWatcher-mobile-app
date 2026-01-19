import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PRODUCTION_API_URL: string | null = 'https://willhabenwatcher-mobile-app-production.up.railway.app';

export interface Vehicle {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  mileage: number | null;
  location: string;
  fuelType: string | null;
  imageUrl: string | null;
  willhabenUrl: string | null;
  phone: string | null;
  sellerName: string | null;
  isNew?: boolean;
  firstSeenAt?: string;
  isPrivate?: boolean;
  postcode?: string;
}

export const getBaseUrl = () => {
  if (PRODUCTION_API_URL) return PRODUCTION_API_URL; // <- Railway URL
  return 'http://localhost:8083'; // za lokalno testiranje
};

export function getApiBaseUrl() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname } = window.location;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8083';
      }
      
      if (hostname.includes('replit') || hostname.includes('riker')) {
        const apiUrl = `${protocol}//${hostname}:3000`;
        console.log('[API] Using Replit external URL:', apiUrl);
        return apiUrl;
      }
      
      return `${protocol}//${hostname}`;
    }
    return 'http://localhost:8083';
  }
  
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host.includes('replit') || host.includes('riker')) {
      console.log('[API] Using Expo Go URL for Replit:', `https://${host}:3000`);
      return `https://${host}:3000`;
    }
    return `http://${host}:8083`;
  }

  return 'http://localhost:8083';
}

export async function fetchVehicles(): Promise<{ vehicles: Vehicle[]; lastScrapeTime: string | null }> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/vehicles`);
    if (!response.ok) {
      throw new Error('Failed to fetch vehicles');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { vehicles: [], lastScrapeTime: null };
  }
}

export async function fetchNewVehicles(): Promise<{ vehicles: Vehicle[]; count: number }> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/vehicles/new`);
    if (!response.ok) {
      throw new Error('Failed to fetch new vehicles');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { vehicles: [], count: 0 };
  }
}

export async function markVehiclesAsSeen(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/vehicles/mark-seen`, {
      method: 'POST',
    });
    return response.ok;
  } catch (error) {
    console.error('API Error:', error);
    return false;
  }
}

export async function triggerScrape(): Promise<{ success: boolean; newCount: number }> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/scrape`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to trigger scrape');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, newCount: 0 };
  }
}

export const API_BASE_URL = getBaseUrl();
