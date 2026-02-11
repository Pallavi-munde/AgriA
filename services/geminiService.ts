
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getGeminiChatResponse = async (message: string, context?: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to the field. Please try again later.";
  }
};

export const getCropRecommendation = async (sensorData: any) => {
  try {
    const prompt = `Based on these sensor readings: 
      Nitrogen (N): ${sensorData.n}
      Phosphorus (P): ${sensorData.p}
      Potassium (K): ${sensorData.k}
      pH: ${sensorData.ph}
      Moisture: ${sensorData.moisture}%
      Temp: ${sensorData.temp}°C
      Humidity: ${sensorData.humidity}%
      Recommend the top 3 optimal crops. Return ONLY a valid JSON array of objects.`;

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
    console.error("Gemini Recommendation Error:", error);
    throw error;
  }
};
