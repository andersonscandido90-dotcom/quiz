
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Exam } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
Você é um oficial da Marinha do Brasil, especialista na elaboração de provas para o concurso QOAM (Quadro Auxiliar de Oficiais da Armada e Fuzileiros Navais).
Sua tarefa é ler o conteúdo de um PDF fornecido e gerar um simulado de alta qualidade.

Diretrizes para as questões:
1. Siga rigorosamente o padrão da Marinha do Brasil: questões de múltipla escolha com 5 opções (A, B, C, D, E).
2. Utilize linguagem formal, técnica e militar quando apropriado.
3. Foque em detalhes importantes, legislação, história naval ou doutrina contida no texto.
4. Evite questões óbvias ou "todas as anteriores".
5. Forneça uma explicação pedagógica para a resposta correta.

Retorne o resultado exclusivamente em formato JSON conforme o schema definido.
`;

export const generateExamFromPDF = async (pdfBase64: string, numQuestions: number = 10): Promise<Exam> => {
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `Gere um simulado com exatamente ${numQuestions} questões baseadas neste documento, seguindo o estilo do concurso QOAM da Marinha do Brasil.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
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
                    properties: {
                      label: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
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

  const content = JSON.parse(response.text || '{}');
  return {
    ...content,
    createdAt: new Date().toISOString(),
  };
};
