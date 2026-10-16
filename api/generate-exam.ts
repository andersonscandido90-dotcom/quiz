import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

const SYSTEM_INSTRUCTION_EXAM = `
Você é um oficial superior da Marinha do Brasil, membro veterano da banca examinadora de concursos da Força Naval, especialista no Quadro de Oficiais Auxiliares da Marinha (QOAM).
Sua missão é formular simulados militares de excelência, rigor técnico, linguagem formal castiça e precisão absoluta com base no documento oficial fornecido.

DIRETRIZES DE FORMULAÇÃO:
1. Cada questão DEVE ter EXATAMENTE 5 alternativas identificadas pelas letras "A", "B", "C", "D" e "E".
2. As opções devem ser críveis e elaboradas com terminologia militar adequada.
3. Identifique com exatidão a alternativa correta ("A", "B", "C", "D" ou "E").
4. No campo "explanation", explique de maneira didática e fundamentada o motivo da alternativa estar correta e das demais estarem erradas.
`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // keep original
    }
  }

  const { extractedText, fileName, totalPages, numQuestions } = body || {};

  if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
    res.status(400).json({ error: 'Nenhum texto foi enviado para elaboração das questões.' });
    return;
  }

  if (!apiKey) {
    res.status(500).json({
      error: 'Chave GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel. Adicione em Settings > Environment Variables.'
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const ai = new GoogleGenAI({ apiKey });
  const targetQuestions = Math.min(100, Math.max(5, parseInt(numQuestions, 10) || 10));
  const title = fileName || 'Simulado QOAM - Marinha do Brasil';

  try {
    sendSSE({
      type: 'progress',
      percent: 25,
      message: `Iniciando elaboração com a IA (${targetQuestions} questões)...`,
      fileName: title,
      currentQuestions: 0,
      totalQuestions: targetQuestions
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { text: `--- DOCUMENTO DE ESTUDO ---\n${extractedText.slice(0, 75000)}\n--- FIM DO DOCUMENTO ---` },
        { text: `Elabore EXATAMENTE ${targetQuestions} questões inéditas no padrão militar da Marinha do Brasil para o concurso QOAM, com 5 opções (A, B, C, D, E) e gabarito comentado.` }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_EXAM,
        responseMimeType: 'application/json',
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
                        text: { type: Type.STRING }
                      },
                      required: ['label', 'text']
                    }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ['id', 'statement', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    const questions = (parsed.questions || []).map((q: any, idx: number) => ({
      ...q,
      id: idx + 1
    }));

    sendSSE({
      type: 'progress',
      percent: 100,
      message: 'Simulado concluído!',
      currentQuestions: questions.length,
      totalQuestions: targetQuestions
    });

    sendSSE({
      type: 'complete',
      exam: {
        title: parsed.title || title,
        category: parsed.category || 'Conhecimentos Militares QOAM',
        questions,
        createdAt: new Date().toISOString(),
        totalPages: totalPages || 1,
        fileName: title
      }
    });

    res.end();
  } catch (err: any) {
    console.error('Vercel API error:', err);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err?.message || 'Erro no servidor Vercel.' })}\n\n`);
      res.end();
    } catch (e) {
      res.status(500).json({ error: err?.message || 'Erro no servidor Vercel.' });
    }
  }
}
