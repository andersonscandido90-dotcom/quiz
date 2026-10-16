import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

const SYSTEM_INSTRUCTION_MINDMAP = `
Você é um instrutor militar sênior especializado em metodologia de estudos, síntese doutrinária e planejamento estratégico naval.
Crie um mapa mental hierárquico e estruturado para o concurso QOAM da Marinha do Brasil.
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

  const { extractedText, fileName, totalPages } = body || {};

  if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
    res.status(400).json({ error: 'Nenhum texto foi enviado para o mapa mental.' });
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

  const title = fileName || 'Mapa Mental QOAM';

  try {
    sendSSE({
      type: 'progress',
      percent: 30,
      message: 'Estruturando tópicos no servidor Vercel...',
      fileName: title
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
}
