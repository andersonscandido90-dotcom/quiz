import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const SYSTEM_INSTRUCTION_EXAM = `
Você é um oficial superior da Marinha do Brasil, membro veterano da banca examinadora de concursos da Força Naval, especialista no Quadro de Oficiais Auxiliares da Marinha (QOAM).
Sua missão é formular simulados militares de excelência, rigor técnico, linguagem formal castiça e precisão absoluta com base no documento oficial fornecido.

DIRETRIZES DE FORMULAÇÃO:
1. Cada questão DEVE ter EXATAMENTE 5 alternativas identificadas pelas letras "A", "B", "C", "D" e "E".
2. As opções devem ser críveis e elaboradas com terminologia militar adequada.
3. Identifique com exatidão a alternativa correta ("A", "B", "C", "D" ou "E").
4. No campo "explanation", explique de maneira didática e fundamentada o motivo da alternativa estar correta e das demais estarem erradas.
`;

const SYSTEM_INSTRUCTION_MINDMAP = `
Você é um instrutor militar sênior especializado em metodologia de estudos, síntese doutrinária e planejamento estratégico naval.
Crie um mapa mental hierárquico e estruturado para o concurso QOAM da Marinha do Brasil.
`;

async function generateWithRetry(params: any): Promise<any> {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ai.models.generateContent({ ...params, model });
        return res;
      } catch (e: any) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

// Handler for Generate Exam
app.post('/api/generate-exam', async (req: Request, res: Response) => {
  try {
    const { extractedText, fileName, totalPages, numQuestions } = req.body;

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
      res.status(400).json({ error: 'Nenhum texto foi enviado para elaboração das questões.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel.'
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

    const targetQuestions = Math.min(100, Math.max(5, parseInt(numQuestions, 10) || 10));
    const title = fileName || 'Simulado QOAM - Marinha do Brasil';

    sendSSE({
      type: 'progress',
      percent: 20,
      message: `Iniciando elaboração na Vercel (${targetQuestions} questões)...`,
      fileName: title,
      currentQuestions: 0,
      totalQuestions: targetQuestions
    });

    const response = await generateWithRetry({
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
});

// Handler for Generate Mindmap
app.post('/api/generate-mindmap', async (req: Request, res: Response) => {
  try {
    const { extractedText, fileName, totalPages } = req.body;

    if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
      res.status(400).json({ error: 'Nenhum texto foi enviado para o mapa mental.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel.'
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

    const title = fileName || 'Mapa Mental QOAM';

    sendSSE({
      type: 'progress',
      percent: 30,
      message: 'Estruturando tópicos no servidor Vercel...',
      fileName: title
    });

    const response = await generateWithRetry({
      contents: [
        { text: `--- DOCUMENTO DE ESTUDO ---\n${extractedText.slice(0, 75000)}\n--- FIM DO DOCUMENTO ---` },
        { text: 'Crie um mapa mental aprofundado, detalhado e estruturado deste documento para estudo de oficiais da Marinha do Brasil no concurso QOAM.' }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_MINDMAP,
        responseMimeType: 'application/json',
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
                          required: ['id', 'text']
                        }
                      }
                    },
                    required: ['id', 'text']
                  }
                }
              },
              required: ['id', 'text']
            }
          },
          required: ['title', 'root']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');

    sendSSE({
      type: 'progress',
      percent: 100,
      message: 'Mapa mental concluído!'
    });

    sendSSE({
      type: 'complete',
      mindMap: {
        ...parsed,
        createdAt: new Date().toISOString(),
        totalPages: totalPages || 1,
        fileName: title
      }
    });

    res.end();
  } catch (err: any) {
    console.error('Vercel Mindmap API error:', err);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err?.message || 'Erro no servidor Vercel.' })}\n\n`);
      res.end();
    } catch (e) {
      res.status(500).json({ error: err?.message || 'Erro no servidor Vercel.' });
    }
  }
});

// Fallback for any other API route
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota de API não encontrada.' });
});

export default app;
