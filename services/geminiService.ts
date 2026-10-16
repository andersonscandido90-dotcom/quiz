import { Exam, MindMap, ProgressState } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { extractTextFromPdfInBrowser } from './pdfExtractService';

export const getStoredApiKey = (): string => {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key') ||
    ''
  );
};

export const saveStoredApiKey = (key: string): void => {
  if (key && key.trim()) {
    localStorage.setItem('gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('gemini_api_key');
  }
};

const SYSTEM_INSTRUCTION_EXAM = `
Você é um oficial superior da Marinha do Brasil, membro veterano da banca examinadora de concursos da Força Naval, especialista no Quadro de Oficiais Auxiliares da Marinha (QOAM).
Sua missão é formular simulados militares de excelência, rigor técnico, linguagem formal castiça e precisão absoluta com base no documento oficial fornecido (manuais da Marinha, legislação militar, portarias, DGMM, EMA, SGM, etc.).

DIRETRIZES DE FORMULAÇÃO:
1. Cada questão DEVE ter EXATAMENTE 5 alternativas identificadas pelas letras "A", "B", "C", "D" e "E".
2. As opções devem ser críveis e elaboradas com terminologia militar adequada, sem pegadinhas tolas.
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

// Helper to ask candidate for Gemini API key if running in static client mode (Vercel)
function ensureApiKey(promptReason: string = ''): string {
  let key = getStoredApiKey();
  if (key) return key;

  const msg = promptReason
    ? `${promptReason}\n\nPara continuar gerando o simulado diretamente pelo seu navegador (gratuito e sem limite de servidor), insira sua chave do Google Gemini (API Key):`
    : 'Insira sua chave gratuita do Google Gemini (Google AI Studio) para gerar o simulado diretamente no navegador:';

  const inputKey = window.prompt(msg);
  if (!inputKey || !inputKey.trim()) {
    throw new Error('Chave de API do Gemini não informada. Clique no botão "Como Obter / Inserir Chave Gemini" no topo da página para configurar.');
  }

  saveStoredApiKey(inputKey.trim());
  return inputKey.trim();
}

// Direct Client-Side Generation (Never fails with Vercel serverless errors or 404!)
export async function generateExamClientSide(
  extractedText: string,
  fileName: string,
  totalPages: number,
  numQuestions: number,
  onProgress: (state: ProgressState) => void,
  reason: string = ''
): Promise<Exam> {
  const key = ensureApiKey(reason);
  const ai = new GoogleGenAI({ apiKey: key });
  const targetQuestions = Math.min(100, Math.max(5, numQuestions));

  onProgress({
    percent: 15,
    message: 'Processamento local ativado no navegador. Conectando diretamente à IA do Gemini...',
    fileName,
    currentQuestions: 0,
    totalQuestions: targetQuestions
  });

  const batchSize = targetQuestions <= 20 ? targetQuestions : 25;
  const totalBatches = Math.ceil(targetQuestions / batchSize);
  const allQuestions: any[] = [];
  let detectedTitle = 'Simulado QOAM - Marinha do Brasil';
  let detectedCategory = 'Conhecimentos Militares e Navais';

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startId = batchIndex * batchSize + 1;
    const count = Math.min(batchSize, targetQuestions - (batchIndex * batchSize));
    const endId = startId + count - 1;

    const currentBase = 15 + Math.round((batchIndex / totalBatches) * 78);
    onProgress({
      percent: currentBase,
      message: `Elaborando Lote ${batchIndex + 1} de ${totalBatches} (Questões ${startId} a ${endId})...`,
      batch: batchIndex + 1,
      totalBatches,
      currentQuestions: allQuestions.length,
      totalQuestions: targetQuestions,
      fileName
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { text: `--- DOCUMENTO DE ESTUDO ---\n${extractedText.slice(0, 80000)}\n--- FIM DO DOCUMENTO ---` },
        { text: `Gere EXATAMENTE ${count} questões inéditas numeradas de ${startId} a ${endId} para o concurso QOAM com 5 alternativas (A, B, C, D, E) e gabarito comentado.` }
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
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.title) detectedTitle = parsed.title;
    if (parsed.category) detectedCategory = parsed.category;

    if (Array.isArray(parsed.questions)) {
      parsed.questions.forEach((q: any, idx: number) => {
        allQuestions.push({
          ...q,
          id: startId + idx,
        });
      });
    }

    if (batchIndex < totalBatches - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const finalQuestions = allQuestions.slice(0, targetQuestions).map((q, idx) => ({
    ...q,
    id: idx + 1,
  }));

  onProgress({
    percent: 100,
    message: 'Simulado concluído com sucesso!',
    currentQuestions: finalQuestions.length,
    totalQuestions: targetQuestions,
    fileName
  });

  return {
    title: detectedTitle,
    category: detectedCategory,
    questions: finalQuestions,
    createdAt: new Date().toISOString(),
    totalPages,
    fileName
  };
}

// Direct Client-Side Mind Map Generation
export async function generateMindMapClientSide(
  extractedText: string,
  fileName: string,
  totalPages: number,
  onProgress: (state: ProgressState) => void,
  reason: string = ''
): Promise<MindMap> {
  const key = ensureApiKey(reason);
  const ai = new GoogleGenAI({ apiKey: key });

  onProgress({
    percent: 30,
    message: 'Processamento direto no navegador ativado. Mapeando hierarquias com a IA...',
    fileName
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      { text: `--- DOCUMENTO DE ESTUDO ---\n${extractedText.slice(0, 80000)}\n--- FIM DO DOCUMENTO ---` },
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

  onProgress({
    percent: 100,
    message: 'Mapa mental concluído com sucesso!',
    fileName
  });

  return {
    ...parsed,
    createdAt: new Date().toISOString(),
    totalPages,
    fileName
  };
}

// Process SSE stream from server
async function processSSEStream(
  response: Response,
  onProgress: (state: ProgressState) => void,
  defaultFileName: string,
  targetQuestions?: number
): Promise<{ exam?: Exam; mindMap?: MindMap }> {
  if (!response.body) {
    throw new Error('Falha na conexão de streaming com o servidor.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalExam: Exam | null = null;
  let finalMindMap: MindMap | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const chunk of lines) {
      const trimmed = chunk.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      try {
        const data = JSON.parse(jsonStr);
        if (data.type === 'progress') {
          onProgress({
            percent: data.percent,
            message: data.message,
            batch: data.batch,
            totalBatches: data.totalBatches,
            currentQuestions: data.currentQuestions,
            totalQuestions: data.totalQuestions || targetQuestions,
            fileName: data.fileName || defaultFileName,
            fileSizeFormatted: data.fileSizeFormatted,
          });
        } else if (data.type === 'complete') {
          if (data.exam) finalExam = data.exam;
          if (data.mindMap) finalMindMap = data.mindMap;
        } else if (data.type === 'error') {
          throw new Error(data.message || 'Erro durante o processamento da IA.');
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }
  }

  return { exam: finalExam || undefined, mindMap: finalMindMap || undefined };
}

// Hybrid Generation: tries server first; if 404, 500, or Vercel serverless fails, seamlessly runs client-side!
export const streamGenerateExamFromText = async (
  extractedText: string,
  fileName: string,
  totalPages: number,
  numQuestions: number,
  onProgress: (state: ProgressState) => void
): Promise<Exam> => {
  onProgress({
    percent: 10,
    message: `Iniciando elaboração com a IA (${extractedText.split(/\s+/).length} palavras lidas)...`,
    fileName,
    totalQuestions: numQuestions,
    currentQuestions: 0,
  });

  try {
    const response = await fetch('/api/generate-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedText,
        fileName,
        totalPages,
        numQuestions
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Endpoint /api/generate-exam retornou status ${response.status}. Alternando para processamento direto no navegador...`);
      return await generateExamClientSide(
        extractedText,
        fileName,
        totalPages,
        numQuestions,
        onProgress,
        `O servidor da Vercel retornou código ${response.status}.`
      );
    }

    const { exam } = await processSSEStream(response, onProgress, fileName, numQuestions);
    if (!exam) {
      throw new Error('O servidor encerrou sem entregar o simulado completo.');
    }
    return exam;
  } catch (err: any) {
    const msg = err?.message || '';
    console.warn('Erro de rede ou servidor ao chamar /api/generate-exam, alternando para o modo direto no navegador...', msg);
    return await generateExamClientSide(
      extractedText,
      fileName,
      totalPages,
      numQuestions,
      onProgress,
      'Alternando para execução direta no navegador...'
    );
  }
};

// Fallback upload of binary file with automatic client-side extraction if server is 404
export const streamGenerateExamFromPDF = async (
  file: File,
  numQuestions: number,
  onProgress: (state: ProgressState) => void
): Promise<Exam> => {
  onProgress({
    percent: 5,
    message: `Lendo e preparando arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`,
    fileName: file.name,
    totalQuestions: numQuestions,
    currentQuestions: 0,
  });

  // Always attempt local browser extraction first for maximum reliability!
  try {
    const localResult = await extractTextFromPdfInBrowser(file, 1, 100);
    if (localResult.text && localResult.text.length > 50) {
      return await streamGenerateExamFromText(
        localResult.text,
        file.name,
        localResult.totalPages,
        numQuestions,
        onProgress
      );
    }
  } catch (e) {
    console.warn('Extração local de texto pelo navegador falhou, tentando envio de arquivo para o servidor...', e);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('numQuestions', numQuestions.toString());

  try {
    const response = await fetch('/api/generate-exam', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.warn(`Envio de PDF para /api/generate-exam retornou status ${response.status}.`);
      // Try local extraction as fallback
      const localResult = await extractTextFromPdfInBrowser(file);
      return await generateExamClientSide(
        localResult.text,
        file.name,
        localResult.totalPages,
        numQuestions,
        onProgress,
        `O servidor retornou status ${response.status}.`
      );
    }

    const { exam } = await processSSEStream(response, onProgress, file.name, numQuestions);
    if (!exam) {
      throw new Error('O servidor encerrou sem entregar o simulado completo.');
    }
    return exam;
  } catch (err: any) {
    console.warn('Falha no upload do PDF, alternando para extração no navegador:', err);
    const localResult = await extractTextFromPdfInBrowser(file);
    return await generateExamClientSide(
      localResult.text,
      file.name,
      localResult.totalPages,
      numQuestions,
      onProgress
    );
  }
};

// Mind Map Hybrid Generation
export const streamGenerateMindMapFromText = async (
  extractedText: string,
  fileName: string,
  totalPages: number,
  onProgress: (state: ProgressState) => void
): Promise<MindMap> => {
  onProgress({
    percent: 10,
    message: `Estruturando mapa mental estratégico...`,
    fileName,
  });

  try {
    const response = await fetch('/api/generate-mindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedText,
        fileName,
        totalPages
      }),
    });

    if (!response.ok) {
      console.warn(`Endpoint /api/generate-mindmap retornou status ${response.status}. Alternando para processamento direto no navegador...`);
      return await generateMindMapClientSide(
        extractedText,
        fileName,
        totalPages,
        onProgress,
        `O servidor retornou código ${response.status}.`
      );
    }

    const { mindMap } = await processSSEStream(response, onProgress, fileName);
    if (!mindMap) {
      throw new Error('O servidor encerrou sem entregar o mapa mental.');
    }
    return mindMap;
  } catch (err: any) {
    console.warn('Alternando para execução de mapa mental direto no navegador...');
    return await generateMindMapClientSide(
      extractedText,
      fileName,
      totalPages,
      onProgress
    );
  }
};

// Fallback upload of binary file for mindmap
export const streamGenerateMindMapFromPDF = async (
  file: File,
  onProgress: (state: ProgressState) => void
): Promise<MindMap> => {
  onProgress({
    percent: 5,
    message: `Lendo arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`,
    fileName: file.name,
  });

  try {
    const localResult = await extractTextFromPdfInBrowser(file);
    if (localResult.text && localResult.text.length > 50) {
      return await streamGenerateMindMapFromText(
        localResult.text,
        file.name,
        localResult.totalPages,
        onProgress
      );
    }
  } catch (e) {
    console.warn('Extração local de texto para mapa mental falhou:', e);
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/generate-mindmap', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const localResult = await extractTextFromPdfInBrowser(file);
      return await generateMindMapClientSide(
        localResult.text,
        file.name,
        localResult.totalPages,
        onProgress
      );
    }

    const { mindMap } = await processSSEStream(response, onProgress, file.name);
    if (!mindMap) {
      throw new Error('O servidor encerrou sem entregar o mapa mental.');
    }
    return mindMap;
  } catch (err: any) {
    const localResult = await extractTextFromPdfInBrowser(file);
    return await generateMindMapClientSide(
      localResult.text,
      file.name,
      localResult.totalPages,
      onProgress
    );
  }
};
