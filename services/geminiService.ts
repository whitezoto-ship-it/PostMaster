import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Ideally, the API key should be securely managed.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateCaption = async (topic: string, type: string): Promise<string> => {
  try {
    const prompt = `Escreva uma legenda envolvente para um post de mídia social (Instagram/Facebook).
    Tópico: ${topic}
    Tipo de post: ${type}
    Idioma: Português (Moçambique).
    Inclua hashtags relevantes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a legenda.";
  } catch (error) {
    console.error("Error generating caption:", error);
    return "Erro ao gerar legenda. Verifique sua chave API.";
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const generateVideo = async (prompt: string, imageBase64?: string): Promise<string | null> => {
  try {
    // Veo video generation
    let operation;
    
    if (imageBase64) {
        // Remove header if present for API
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: base64Data,
                mimeType: 'image/png', // Assuming PNG for simplicity from canvas/generation
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16' // Portrait for Reels
            }
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16'
            }
        });
    }

    // Polling for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
        // Fetch the video content
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    }
    
    return null;

  } catch (error) {
    console.error("Error generating video:", error);
    return null;
  }
};
