import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configure Gemini client
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Configure Multer for PDF uploads up to 100MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB (${kb.toFixed(0)} KB)`;
};

const SYSTEM_INSTRUCTION_EXAM = `
Você é um oficial superior da Marinha do Brasil, membro veterano da banca examinadora de concursos da Força Naval, especialista no Quadro de Oficiais Auxiliares da Marinha (QOAM).
Sua missão é formular simulados militares de excelência, rigor técnico, linguagem formal castiça e precisão absoluta com base no documento oficial fornecido (manuais da Marinha, legislação militar, portarias, DGMM, EMA, SGM, etc.).

DIRETRIZES DE FORMULAÇÃO:
1. Cada questão DEVE ter EXATAMENTE 5 alternativas identificadas pelas letras "A", "B", "C", "D" e "E".
2. As opções devem ser críveis e elaboradas com terminologia militar adequada, sem pegadinhas tolas e sem alternativas óbvias como "todas as anteriores" ou "nenhuma das anteriores".
3. Identifique com exatidão a alternativa correta ("A", "B", "C", "D" ou "E").
4. No campo "explanation" (Gabarito Comentado), explique de maneira didática e fundamentada o motivo da alternativa estar correta, citando o artigo, norma, capítulo ou fundamentação presente no texto, e esclarecendo sucintamente o equívoco das outras opções.
`;

const SYSTEM_INSTRUCTION_MINDMAP = `
Você é um instrutor militar sênior especializado em metodologia de estudos, síntese doutrinária e planejamento estratégico naval.
Sua missão é analisar o documento militar fornecido e criar uma estrutura de MAPA MENTAL lógica, hierárquica e altamente didática para o concurso QOAM.
Extraia os conceitos centrais, regulamentações, prazos, competências e procedimentos técnicos.
Estrutura: Tópico Central -> Tópicos Principais -> Subtópicos -> Detalhes Críticos.
Mantenha os textos objetivos, claros e focados na aprovação.
`;

// Helper to extract text and info from PDF buffer
async function extractPdfContent(buffer: Buffer) {
  let text = '';
  let totalPages = 1;
  try {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    text = (textResult.text || '').trim();
    totalPages = textResult.total || 1;
    await parser.destroy();
  } catch (err) {
    console.warn('PDFParse warning:', err);
  }
  return { text, totalPages };
}

// Smart multi-model retry engine: handles 503 high demand spikes and 429 quota exhaustion gracefully
async function generateWithRobustRetry(
  params: any,
  onNotify?: (msg: string) => void
): Promise<any> {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        const status = err?.status || err?.code;
        const isUnavailable = status === 503 || msg.includes('503') || msg.includes('demand') || msg.includes('UNAVAILABLE');
        const isRateLimit = status === 429 || msg.includes('429') || msg.includes('Quota exceeded') || status === 'RESOURCE_EXHAUSTED';

        if (isRateLimit) {
          const delaySec = 16;
          if (onNotify) onNotify(`Aguardando cota da API (${delaySec}s)... Retomando automaticamente.`);
          console.warn(`[Gemini 429 RateLimit on ${model}, attempt ${attempt}]. Waiting ${delaySec}s...`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
        } else if (isUnavailable) {
          const delaySec = attempt * 2;
          if (onNotify) onNotify(`Servidor de IA com alta demanda momentânea. Tentando novamente em ${delaySec}s...`);
          console.warn(`[Gemini 503 HighDemand on ${model}, attempt ${attempt}]. Waiting ${delaySec}s...`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
        } else {
          const delaySec = 2;
          if (onNotify) onNotify(`Reconectando canal de IA (${delaySec}s)...`);
          console.warn(`[Gemini Error on ${model}, attempt ${attempt}]: ${msg}`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
        }
      }
    }
    if (onNotify) onNotify(`Alternando canal de IA (${model} -> backup)...`);
  }
  throw lastError;
}

// Smart text windowing: partitions huge documents across batches
function getBatchTextSegment(fullText: string, batchIndex: number, totalBatches: number): string {
  const totalLength = fullText.length;
  if (totalLength <= 40000 || totalBatches <= 1) {
    return fullText;
  }

  const intro = fullText.slice(0, 2000);
  const remainingText = fullText.slice(2000);
  const remainingLength = remainingText.length;

  const segmentSize = Math.ceil(remainingLength / totalBatches);
  const overlap = Math.floor(segmentSize * 0.12);

  const start = Math.max(0, batchIndex * segmentSize - overlap);
  const end = Math.min(remainingLength, (batchIndex + 1) * segmentSize + overlap);

  const segmentContent = remainingText.slice(start, end);

  return `--- INTRODUÇÃO E ESTRUTURA GERAL DO DOCUMENTO ---\n${intro}\n\n--- SEÇÃO ESPECÍFICA DO DOCUMENTO PARA ESTE LOTE (Parte ${batchIndex + 1} de ${totalBatches}) ---\n${segmentContent}\n--- FIM DO SEGMENTO ---`;
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

// Endpoint: Generate Exam with SSE Progress Stream
// Supports BOTH JSON extracted text (ultrafast, no file upload lag!) AND multipart file upload
app.post('/api/generate-exam', upload.single('file'), async (req: Request, res: Response) => {
  const body = parseSafeBody(req.body);
  const hasFile = !!req.file;
  const hasText = !!body.extractedText && typeof body.extractedText === 'string' && body.extractedText.trim().length > 0;

  if (!hasFile && !hasText) {
    res.status(400).json({ error: 'Nenhum arquivo ou texto foi enviado.' });
    return;
  }

  // Disable socket timeouts for long-running streaming
  req.socket?.setTimeout(0);
  res.socket?.setTimeout(0);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const targetQuestions = Math.min(100, Math.max(5, parseInt(body.numQuestions, 10) || 10));
  const fileName = body.fileName || req.file?.originalname || 'documento.pdf';
  const fileSizeFormatted = req.file ? formatFileSize(req.file.size) : (body.fileSizeFormatted || 'Texto direto');

  try {
    let extractedText = '';
    let totalPages = parseInt(body.totalPages, 10) || 1;

    if (hasText) {
      extractedText = body.extractedText.trim();
      sendSSE({
        type: 'progress',
        percent: 15,
        message: `Texto carregado instantaneamente (${totalPages} página${totalPages > 1 ? 's' : ''}, ${extractedText.split(/\s+/).length} palavras). Preparando lotes...`,
        fileName,
        fileSizeFormatted,
        currentQuestions: 0,
        totalQuestions: targetQuestions
      });
    } else if (req.file) {
      sendSSE({
        type: 'progress',
        percent: 5,
        message: `Analisando arquivo PDF (${fileSizeFormatted})...`,
        fileName,
        fileSizeFormatted,
        currentQuestions: 0,
        totalQuestions: targetQuestions
      });

      const parsed = await extractPdfContent(req.file.buffer);
      extractedText = parsed.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      totalPages = parsed.totalPages || 1;

      sendSSE({
        type: 'progress',
        percent: 15,
        message: `Documento processado (${totalPages} páginas). Preparando simulado...`,
        fileName,
        fileSizeFormatted,
        currentQuestions: 0,
        totalQuestions: targetQuestions
      });
    }

    const isTextMode = extractedText.length > 100;
    let baseInlineDataPart: any = null;

    if (!isTextMode && req.file) {
      if (req.file.size > 20 * 1024 * 1024) {
        sendSSE({
          type: 'error',
          message: 'O PDF enviado é escaneado (sem texto digital) e excede 20MB. Por favor, utilize um PDF com texto pesquisável ou de até 20MB.'
        });
        res.end();
        return;
      }
      baseInlineDataPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: req.file.buffer.toString('base64')
        }
      };
    }

    const batchSize = targetQuestions <= 20 ? targetQuestions : 25;
    const totalBatches = Math.ceil(targetQuestions / batchSize);

    const batchThemes = [
      'Conceitos Fundamentais, Estrutura Organizacional, Doutrina Militar-Naval e Normas Gerais constantes no documento.',
      'Legislação Militar, Estatuto dos Militares, Regulamentos Disciplinares, Deveres e Hierarquia Militar.',
      'Procedimentos Operacionais, Segurança, Normas Técnicas, Comunicações e Logística Naval do documento.',
      'Casos Práticos, Tomada de Decisão em Situações Hipotéticas Navais, Liderança Militar e Jurisprudência/Aplicações.'
    ];

    const allQuestions: any[] = [];
    let detectedTitle = 'Simulado QOAM - Marinha do Brasil';
    let detectedCategory = 'Conhecimentos Profissionais Militares';

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startId = batchIndex * batchSize + 1;
      const count = Math.min(batchSize, targetQuestions - (batchIndex * batchSize));
      const endId = startId + count - 1;
      const theme = batchThemes[batchIndex % batchThemes.length];

      const contentsParts: any[] = [];
      if (isTextMode) {
        const batchText = getBatchTextSegment(extractedText, batchIndex, totalBatches);
        contentsParts.push({ text: batchText });
      } else if (baseInlineDataPart) {
        contentsParts.push(baseInlineDataPart);
      }

      const batchPrompt = `
Você está gerando o Lote ${batchIndex + 1} de ${totalBatches} de um simulado completo para o concurso QOAM da Marinha do Brasil.
Gere EXATAMENTE ${count} questões INÉDITAS, numeradas estritamente de ${startId} a ${endId}.

Tema / Foco prioritário deste lote:
${theme}

Instruções:
- Baseie todas as questões com estrita fidelidade no conteúdo fornecido do documento.
- Todas as questões devem ter enunciados claros e formais, com 5 opções (A, B, C, D, E) e apenas uma resposta correta.
- O campo "explanation" deve justificar formalmente o gabarito comentado, demonstrando o erro das demais opções.
- Se for o primeiro lote, defina um "title" representativo do assunto do documento e a "category".
`;

      contentsParts.push({ text: batchPrompt });

      const currentProgressBase = 15 + Math.round((batchIndex / totalBatches) * 78);
      sendSSE({
        type: 'progress',
        percent: currentProgressBase,
        message: `Elaborando Lote ${batchIndex + 1} de ${totalBatches} (Questões ${startId} a ${endId})...`,
        batch: batchIndex + 1,
        totalBatches,
        currentQuestions: allQuestions.length,
        totalQuestions: targetQuestions
      });

      const response = await generateWithRobustRetry(
        {
          contents: contentsParts,
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
                            text: { type: Type.STRING },
                          },
                          required: ['label', 'text'],
                        },
                      },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'statement', 'options', 'correctAnswer', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        },
        (retryMsg) => {
          sendSSE({
            type: 'progress',
            percent: currentProgressBase,
            message: retryMsg,
            batch: batchIndex + 1,
            totalBatches,
            currentQuestions: allQuestions.length,
            totalQuestions: targetQuestions
          });
        }
      );

      const parsedBatch = JSON.parse(response.text || '{}');
      if (parsedBatch.title) detectedTitle = parsedBatch.title;
      if (parsedBatch.category) detectedCategory = parsedBatch.category;

      if (Array.isArray(parsedBatch.questions)) {
        parsedBatch.questions.forEach((q: any, idx: number) => {
          allQuestions.push({
            ...q,
            id: startId + idx,
          });
        });
      }

      const progressAfterBatch = 15 + Math.round(((batchIndex + 1) / totalBatches) * 78);
      sendSSE({
        type: 'progress',
        percent: Math.min(95, progressAfterBatch),
        message: `Lote ${batchIndex + 1}/${totalBatches} finalizado! (${allQuestions.length} de ${targetQuestions} questões prontas)...`,
        batch: batchIndex + 1,
        totalBatches,
        currentQuestions: allQuestions.length,
        totalQuestions: targetQuestions
      });

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const finalQuestions = allQuestions.slice(0, targetQuestions).map((q, idx) => ({
      ...q,
      id: idx + 1,
    }));

    sendSSE({
      type: 'progress',
      percent: 100,
      message: `Simulado completo finalizado com sucesso! Consolidando ${finalQuestions.length} questões...`,
      currentQuestions: finalQuestions.length,
      totalQuestions: targetQuestions
    });

    const examPayload = {
      title: detectedTitle,
      category: detectedCategory,
      questions: finalQuestions,
      createdAt: new Date().toISOString(),
      totalPages,
      fileSizeFormatted,
      fileName
    };

    sendSSE({
      type: 'complete',
      exam: examPayload
    });

    res.end();
  } catch (error: any) {
    console.error('Error in /api/generate-exam:', error);
    let userMsg = 'Falha ao processar o PDF com a IA. Por favor, tente novamente.';
    if (error?.message) {
      if (error.message.includes('429') || error.message.includes('Quota exceeded')) {
        userMsg = 'O limite de requisições da API foi atingido temporariamente. Aguarde 20 segundos e tente novamente.';
      } else if (error.message.includes('503') || error.message.includes('demand')) {
        userMsg = 'O serviço de IA está passando por alta demanda temporária. Tentando novamente logo em seguida deve concluir com sucesso.';
      } else {
        userMsg = error.message;
      }
    }
    sendSSE({
      type: 'error',
      message: userMsg
    });
    res.end();
  }
});

// Endpoint: Generate Mind Map with SSE Progress Stream
app.post('/api/generate-mindmap', upload.single('file'), async (req: Request, res: Response) => {
  const body = parseSafeBody(req.body);
  const hasFile = !!req.file;
  const hasText = !!body.extractedText && typeof body.extractedText === 'string' && body.extractedText.trim().length > 0;

  if (!hasFile && !hasText) {
    res.status(400).json({ error: 'Nenhum arquivo ou texto foi enviado.' });
    return;
  }

  req.socket?.setTimeout(0);
  res.socket?.setTimeout(0);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const fileName = body.fileName || req.file?.originalname || 'documento.pdf';
  const fileSizeFormatted = req.file ? formatFileSize(req.file.size) : (body.fileSizeFormatted || 'Texto direto');

  try {
    let extractedText = '';
    let totalPages = parseInt(body.totalPages, 10) || 1;

    if (hasText) {
      extractedText = body.extractedText.trim();
      sendSSE({
        type: 'progress',
        percent: 25,
        message: `Texto lido (${totalPages} páginas, ${extractedText.split(/\s+/).length} palavras). Mapeando hierarquias...`,
        fileName,
        fileSizeFormatted
      });
    } else if (req.file) {
      sendSSE({
        type: 'progress',
        percent: 15,
        message: `Carregando PDF (${fileSizeFormatted})...`,
        fileName,
        fileSizeFormatted
      });

      const parsed = await extractPdfContent(req.file.buffer);
      extractedText = parsed.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      totalPages = parsed.totalPages || 1;

      sendSSE({
        type: 'progress',
        percent: 35,
        message: `Estruturando documento (${totalPages} páginas). Mapeando tópicos militares...`,
        fileName,
        fileSizeFormatted
      });
    }

    const contentsParts: any[] = [];
    if (extractedText.length > 100) {
      const cleanText = extractedText.length > 80000
        ? extractedText.slice(0, 80000) + '\n\n[... Demais seções condensadas ...]'
        : extractedText;
      contentsParts.push({
        text: `--- CONTEÚDO OFICIAL DO DOCUMENTO (${totalPages} PÁGINAS) ---\n\n${cleanText}\n\n--- FIM DO DOCUMENTO ---`
      });
    } else if (req.file) {
      if (req.file.size > 20 * 1024 * 1024) {
        sendSSE({
          type: 'error',
          message: 'O PDF enviado é escaneado e excede 20MB. Por favor, envie um PDF com camada de texto ou com menos de 20MB.'
        });
        res.end();
        return;
      }
      contentsParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: req.file.buffer.toString('base64')
        }
      });
    }

    sendSSE({
      type: 'progress',
      percent: 65,
      message: 'Criando conexões estratégicas e nós conceituais para memorização...',
      fileName,
      fileSizeFormatted
    });

    const response = await generateWithRobustRetry(
      {
        contents: [
          ...contentsParts,
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
      },
      (retryMsg) => {
        sendSSE({
          type: 'progress',
          percent: 65,
          message: retryMsg
        });
      }
    );

    const mindMapData = JSON.parse(response.text || '{}');

    sendSSE({
      type: 'progress',
      percent: 100,
      message: 'Mapa mental estratégico finalizado com sucesso!'
    });

    sendSSE({
      type: 'complete',
      mindMap: {
        ...mindMapData,
        createdAt: new Date().toISOString(),
        totalPages,
        fileName
      }
    });

    res.end();
  } catch (error: any) {
    console.error('Error in /api/generate-mindmap:', error);
    let userMsg = 'Falha ao gerar mapa mental. Tente novamente.';
    if (error?.message && (error.message.includes('429') || error.message.includes('Quota exceeded'))) {
      userMsg = 'Limite temporário de requisições atingido. Aguarde alguns segundos e tente novamente.';
    }
    sendSSE({
      type: 'error',
      message: userMsg
    });
    res.end();
  }
});

// Setup Vite or Static Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  if (!process.env.VERCEL) {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${port}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
