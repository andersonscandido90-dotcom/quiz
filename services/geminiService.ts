
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Exam, MindMap } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION_EXAM = `
Você é um oficial da Marinha do Brasil, especialista na elaboração de provas para o concurso QOAM.
Sua tarefa é ler o conteúdo de um PDF fornecido e gerar um simulado de alta qualidade no padrão da Marinha (5 opções, linguagem formal).
`;

const SYSTEM_INSTRUCTION_MINDMAP = `
Você é um instrutor militar especializado em técnicas de memorização e planejamento estratégico. 
Sua tarefa é analisar o PDF e criar uma estrutura de MAPA MENTAL lógica e hierárquica.
Extraia os conceitos fundamentais, legislações, datas ou normas técnicas.
Estruture como: Tópico Central -> Tópicos Principais -> Subtópicos -> Detalhes Importantes.
Mantenha os textos curtos e objetivos.
`;

export const generateExamFromPDF = async (pdfBase64: string, numQuestions: number = 10): Promise<Exam> => {
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: `Gere um simulado com exatamente ${numQuestions} questões baseadas neste documento.` }
      ]
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_EXAM,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                statement: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { label: { type: Type.STRING }, text: { type: Type.STRING } },
                    required: ["label", "text"],
                  },
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["id", "statement", "options", "correctAnswer", "explanation"],
            },
          },
        },
        required: ["title", "category", "questions"],
      },
    },
  });

  return { ...JSON.parse(response.text || '{}'), createdAt: new Date().toISOString() };
};

export const generateMindMapFromPDF = async (pdfBase64: string): Promise<MindMap> => {
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: `Crie um mapa mental detalhado e estruturado deste documento para estudo militar.` }
      ]
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_MINDMAP,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          root: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    description: { type: Type.STRING },
                    children: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                          description: { type: Type.STRING }
                        },
                        required: ["id", "text"]
                      }
                    }
                  },
                  required: ["id", "text"]
                }
              }
            },
            required: ["id", "text"]
          }
        },
        required: ["title", "root"]
      }
    }
  });

  return { ...JSON.parse(response.text || '{}'), createdAt: new Date().toISOString() };
};
