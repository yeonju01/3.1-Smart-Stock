import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedProduct } from "./types";

/**
 * URL 또는 Data URL을 Base64 데이터 부분만 추출하여 반환합니다.
 */
async function toBase64Data(input: string): Promise<{ data: string, mimeType: string } | null> {
  if (input.startsWith('data:')) {
    const [header, data] = input.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    return { data, mimeType };
  }
  
  try {
    const response = await fetch(input);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const [header, data] = base64.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        resolve({ data, mimeType });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to convert image to base64:", e);
    return null;
  }
}

function getApiKey(): string {
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv?.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;
    if (metaEnv?.GEMINI_API_KEY) return metaEnv.GEMINI_API_KEY;
  } catch {}
  return '';
}

export async function extractProductInfo(base64Image: string): Promise<ExtractedProduct[] | null> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey || '' });
    const imageData = await toBase64Data(base64Image);
    if (!imageData) return null;

    // Use gemini-2.5-flash for fast and accurate multimodal extraction
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: "이미지 속의 모든 개별 상품들을 상세히 분석해줘. 규칙 1: 상품에 가격이 여러 개 적혀 있다면, 반드시 가장 마지막(가장 아래 혹은 가장 오른쪽)에 적힌 가격을 최종 가격으로 추출해. 규칙 2: 해당 상품이 세트(SET) 구성이거나 묶음 상품이라면 isSet 필드를 true로 설정해줘. 규칙 3: 상품의 종류(type)와 스타일/장르(genre)를 구분해서 추출해줘. 나머지 모든 텍스트 설명은 한국어로 작성해줘. 결과는 JSON 배열 형식이어야 해."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER, description: "가장 마지막에 기재된 가격" },
              genre: { type: Type.STRING, description: "스타일/장르 (예: 모던, 빈티지 등)" },
              type: { type: Type.STRING, description: "상품의 종류 (예: 상의, 하의, 신발 등)" },
              isSet: { type: Type.BOOLEAN, description: "세트 상품 여부" },
              description: { type: Type.STRING, description: "상품에 대한 짧은 한국어 설명" }
            },
            required: ["name", "price", "genre", "type", "isSet", "description"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("AI Extraction Error:", error);
    return null;
  }
}

export async function editProductImage(base64Image: string, prompt: string): Promise<string | null> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey || '' });
    const imageData = await toBase64Data(base64Image);
    if (!imageData) {
      console.error("Could not process image data for editing");
      return null;
    }

    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-002',
      contents: {
        parts: [
          {
            text: `Professional product photo editing: ${prompt}`,
          },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("AI Image Edit Error:", error);
    return null;
  }
}
