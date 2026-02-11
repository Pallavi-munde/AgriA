
import React from 'react';

export const CROP_DATASET_HINT = "N, P, K, pH, temperature, humidity, and rainfall are core factors for precision recommendation.";

export const MOCK_SENSORS = {
  n: 45,
  p: 52,
  k: 38,
  ph: 6.8,
  moisture: 22,
  temp: 28,
  humidity: 65,
  lastUpdated: new Date().toISOString()
};

export const SYSTEM_INSTRUCTION = `You are an Expert AI Agronomist. 
You provide scientific, practical, and highly accurate advice to farmers regarding crop health, 
soil management (NPK/pH levels), pest control, and sustainable farming. 
Always be encouraging, professional, and clear. 
Use markdown for formatting. 
If sensor data is provided (N, P, K, pH), incorporate it into your diagnosis.`;

export const APP_THEME = {
  primary: 'emerald-600',
  secondary: 'amber-500',
  accent: 'blue-500',
  bg: 'slate-50'
};
