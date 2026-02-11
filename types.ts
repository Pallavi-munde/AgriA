
export enum UserRole {
  FARMER = 'FARMER',
  ADMIN = 'ADMIN'
}

export enum UserStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  farmArea?: number;
  location?: { lat: number; lng: number };
  joinedAt: string;
}

export interface SensorData {
  n: number;
  p: number;
  k: number;
  ph: number;
  moisture: number;
  temp: number;
  humidity: number;
  lastUpdated: string;
}

export interface CropRecommendation {
  crop: string;
  confidence: number;
  suitabilityReason: string;
  seasonalOutlook: string;
}

export interface MarketRate {
  commodity: string;
  market: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  date: string;
  trend: 'up' | 'down' | 'stable';
}

export interface AdBanner {
  id: string;
  imageUrl: string;
  title: string;
  targetUrl: string;
  clicks: number;
}
