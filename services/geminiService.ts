
import { GoogleGenAI, Type } from "@google/genai";
import { getSystemInstruction } from "../constants";

// API key is obtained exclusively from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGeminiChatResponse = async (message: string, lang: string = 'English') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        systemInstruction: getSystemInstruction(lang),
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Advisor node is currently syncing. Please try again soon.";
  }
};

export const diagnosePlantDisease = async (base64Image: string, lang: string = 'English') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: `Identify the plant, analyze any visual symptoms of diseases, pests or nutrient deficiencies, and provide detailed remediation steps including biological and chemical options. Respond strictly in ${lang}.`,
        },
      ],
      config: {
        systemInstruction: `You are a world-class AI Phytopathologist. Provide precise and actionable plant health diagnoses in ${lang}.`,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Diagnosis Error:", error);
    throw error;
  }
};

export const searchMarketTrends = async (commodity: string, lang: string = 'English') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for the latest mandi market prices, volume trends, and government policy news for ${commodity} in India this week. Summarize in ${lang}.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Market Search Error:", error);
    throw error;
  }
};

export const getCropRecommendation = async (sensorData: any, lang: string = 'English') => {
  try {
    const prompt = `Precision Telemetry: N:${sensorData.n}ppm, P:${sensorData.p}ppm, K:${sensorData.k}ppm, pH:${sensorData.ph}, Moisture:${sensorData.moisture}%, Temp:${sensorData.temp}°C.
      Analyze these multi-spectral values and suggest the top 3 high-yield crops. Include confidence scores and seasonal outlooks. Return as JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              crop: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              suitabilityReason: { type: Type.STRING },
              seasonalOutlook: { type: Type.STRING }
            },
            required: ["crop", "confidence", "suitabilityReason", "seasonalOutlook"]
          }
        }
      },
    });
    
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Prediction Error:", error);
    throw error;
  }
};
