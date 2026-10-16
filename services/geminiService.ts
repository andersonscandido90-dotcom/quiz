import { Exam, MindMap, ProgressState } from '../types';

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

// Ultrafast generation sending client-extracted text (0 upload lag!)
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
    const errorText = await response.text();
    throw new Error(errorText || `Erro no servidor: ${response.status}`);
  }

  const { exam } = await processSSEStream(response, onProgress, fileName, numQuestions);
  if (!exam) {
    throw new Error('O servidor encerrou sem entregar o simulado completo.');
  }
  return exam;
};

// Fallback upload of binary file
export const streamGenerateExamFromPDF = async (
  file: File,
  numQuestions: number,
  onProgress: (state: ProgressState) => void
): Promise<Exam> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('numQuestions', numQuestions.toString());

  onProgress({
    percent: 5,
    message: `Enviando arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`,
    fileName: file.name,
    totalQuestions: numQuestions,
    currentQuestions: 0,
  });

  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erro no servidor: ${response.status}`);
  }

  const { exam } = await processSSEStream(response, onProgress, file.name, numQuestions);
  if (!exam) {
    throw new Error('O servidor encerrou sem entregar o simulado completo.');
  }
  return exam;
};

// Ultrafast mind map generation from extracted text
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
    const errorText = await response.text();
    throw new Error(errorText || `Erro no servidor: ${response.status}`);
  }

  const { mindMap } = await processSSEStream(response, onProgress, fileName);
  if (!mindMap) {
    throw new Error('O servidor encerrou sem entregar o mapa mental.');
  }
  return mindMap;
};

// Fallback upload of binary file for mindmap
export const streamGenerateMindMapFromPDF = async (
  file: File,
  onProgress: (state: ProgressState) => void
): Promise<MindMap> => {
  const formData = new FormData();
  formData.append('file', file);

  onProgress({
    percent: 5,
    message: `Enviando arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`,
    fileName: file.name,
  });

  const response = await fetch('/api/generate-mindmap', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erro no servidor: ${response.status}`);
  }

  const { mindMap } = await processSSEStream(response, onProgress, file.name);
  if (!mindMap) {
    throw new Error('O servidor encerrou sem entregar o mapa mental.');
  }
  return mindMap;
};
