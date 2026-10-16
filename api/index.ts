import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

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

function parseSafeBody(body: any): any {
  if (typeof body === 'object' && body !== null) return body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

// Handler for Generate Exam (Supports JSON body and multipart upload without crashing)
app.post('/api/generate-exam', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const body = parseSafeBody(req.body);
    let extractedText = (body.extractedText || '').toString().trim();
    const fileName = body.fileName || req.file?.originalname || 'documento.pdf';
    const totalPages = parseInt(body.totalPages, 10) || 1;
    const numQuestions = Math.min(100, Math.max(5, parseInt(body.numQuestions, 10) || 10));

    // If text was not sent in body, try to extract basic string from buffer if available
    if (!extractedText && req.file?.buffer) {
      const raw = req.file.buffer.toString('utf-8');
      const clean = raw.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ');
      if (clean.length > 200) {
        extractedText = clean;
      }
    }

    if (!extractedText) {
      res.status(400).json({
        error: 'Nenhum texto foi recebido para a elaboração do simulado. Aguarde a leitura do PDF pelo navegador ou utilize a aba "Colar Texto / Norma".'
      });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada nas variáveis da Vercel. Por favor, insira sua chave no botão do topo da página.'
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

    sendSSE({
      type: 'progress',
      percent: 20,
      message: `Iniciando elaboração na Vercel (${numQuestions} questões)...`,
      fileName,
      currentQuestions: 0,
      totalQuestions: numQuestions
    });

    const response = await generateWithRetry({
      contents: [
        { text: `--- DOCUMENTO DE ESTUDO ---\n${extractedText.slice(0, 75000)}\n--- FIM DO DOCUMENTO ---` },
        { text: `Elabore EXATAMENTE ${numQuestions} questões inéditas no padrão militar da Marinha do Brasil para o concurso QOAM, com 5 opções (A, B, C, D, E) e gabarito comentado.` }
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
      totalQuestions: numQuestions
    });

    sendSSE({
      type: 'complete',
      exam: {
        title: parsed.title || fileName,
        category: parsed.category || 'Conhecimentos Militares QOAM',
        questions,
        createdAt: new Date().toISOString(),
        totalPages,
        fileName
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
app.post('/api/generate-mindmap', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const body = parseSafeBody(req.body);
    let extractedText = (body.extractedText || '').toString().trim();
    const fileName = body.fileName || req.file?.originalname || 'documento.pdf';
    const totalPages = parseInt(body.totalPages, 10) || 1;

    if (!extractedText && req.file?.buffer) {
      const raw = req.file.buffer.toString('utf-8');
      const clean = raw.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ');
      if (clean.length > 200) {
        extractedText = clean;
      }
    }

    if (!extractedText) {
      res.status(400).json({ error: 'Nenhum texto foi recebido para a geração do mapa mental.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada nas variáveis da Vercel.'
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

    sendSSE({
      type: 'progress',
      percent: 30,
      message: 'Estruturando tópicos no servidor Vercel...',
      fileName
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
        totalPages,
        fileName
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
