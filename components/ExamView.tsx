import React, { useState, useMemo, useEffect } from 'react';
import { Exam, Question } from '../types';

interface ExamViewProps {
  exam: Exam;
  onReset: () => void;
}

type FilterType = 'all' | 'unanswered' | 'flagged' | 'answered' | 'incorrect' | 'correct';
type ViewMode = 'paginated' | 'full';

const QUESTIONS_PER_PAGE = 10;

const ExamView: React.FC<ExamViewProps> = ({ exam, onReset }) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('paginated');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showNavPalette, setShowNavPalette] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isPaperMode, setIsPaperMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Timer: 100 questions usually gives 4 hours (14400s) in Navy competitions
  const defaultSeconds = exam.questions.length >= 50 ? 4 * 60 * 60 : exam.questions.length * 2.5 * 60;
  const [timeLeft, setTimeLeft] = useState<number>(Math.round(defaultSeconds));
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  useEffect(() => {
    if (!isTimerRunning || showResults) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, showResults]);

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOptionChange = (questionId: number, label: string) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: label }));
  };

  const toggleFlag = (questionId: number) => {
    setFlaggedQuestions(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const totalQuestions = exam.questions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const unansweredCount = totalQuestions - answeredCount;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;

  const calculateScore = () => {
    let score = 0;
    exam.questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  const score = calculateScore();
  const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : '0';

  const filteredQuestions = useMemo(() => {
    return exam.questions.filter(q => {
      const isAnswered = !!userAnswers[q.id];
      const isFlagged = !!flaggedQuestions[q.id];
      const isCorrect = userAnswers[q.id] === q.correctAnswer;

      if (filter === 'unanswered') return !isAnswered;
      if (filter === 'answered') return isAnswered;
      if (filter === 'flagged') return isFlagged;
      if (filter === 'correct' && showResults) return isCorrect;
      if (filter === 'incorrect' && showResults) return isAnswered && !isCorrect;
      return true;
    });
  }, [exam.questions, filter, userAnswers, flaggedQuestions, showResults]);

  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedQuestions = useMemo(() => {
    if (viewMode === 'full') return filteredQuestions;
    const start = (safeCurrentPage - 1) * QUESTIONS_PER_PAGE;
    return filteredQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [filteredQuestions, viewMode, safeCurrentPage]);

  const jumpToQuestion = (questionId: number) => {
    const indexInFiltered = filteredQuestions.findIndex(q => q.id === questionId);
    if (indexInFiltered !== -1) {
      if (viewMode === 'paginated') {
        const targetPage = Math.floor(indexInFiltered / QUESTIONS_PER_PAGE) + 1;
        setCurrentPage(targetPage);
      }
      setTimeout(() => {
        const el = document.getElementById(`question-anchor-${questionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else {
      setFilter('all');
      setTimeout(() => jumpToQuestion(questionId), 100);
    }
  };

  // Robust printing handler that handles iframe restrictions and provides fallback
  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('window.print() bloqueado no ambiente atual. Ativando layout de folha para impressão.', err);
      setIsPaperMode(true);
    }
  };

  // Generates and downloads a standalone printable HTML/PDF file
  const handleDownloadPrintableHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${exam.title} - Marinha do Brasil</title>
  <style>
    @page { margin: 2cm 1.5cm; size: A4; }
    body { font-family: 'Times New Roman', Times, Georgia, serif; line-height: 1.45; color: #111; margin: 0; padding: 25px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 25px; }
    .header h1 { margin: 0; font-size: 20pt; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; }
    .header h2 { margin: 4px 0 0; font-size: 14pt; font-weight: normal; }
    .header p { margin: 4px 0 0; font-size: 11pt; color: #444; }
    .meta-box { border: 1px solid #000; padding: 8px 12px; margin-bottom: 25px; font-size: 10pt; display: flex; justify-content: space-between; font-family: Arial, sans-serif; }
    .question { margin-bottom: 22px; page-break-inside: avoid; }
    .statement { font-weight: bold; font-size: 11pt; margin-bottom: 8px; }
    .options { margin-left: 20px; font-size: 10.5pt; }
    .option { margin-bottom: 4px; }
    .answer-key-section { page-break-before: always; margin-top: 30px; border-top: 2px solid #000; padding-top: 20px; }
    .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; font-family: monospace; font-size: 10pt; margin-top: 15px; }
    .grid-item { border: 1px solid #444; padding: 4px; text-align: center; }
    .comment-item { margin-bottom: 14px; font-size: 10.5pt; }
    .comment-item strong { color: #000; }
    .banner { background: #002147; color: white; padding: 12px; border-radius: 8px; margin-bottom: 25px; text-align: center; font-family: Arial, sans-serif; }
    .btn-print { background: #D4AF37; color: #000; font-weight: bold; border: none; padding: 8px 18px; border-radius: 5px; cursor: pointer; font-size: 13px; margin-top: 5px; }
    @media print {
      .banner { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="banner">
    <strong>Caderno de Prova Oficial - Marinha do Brasil (QOAM)</strong><br>
    <button class="btn-print" onclick="window.print()">CLIQUE AQUI PARA IMPRIMIR OU SALVAR EM PDF</button>
  </div>

  <div class="header">
    <h1>Marinha do Brasil</h1>
    <h2>Quadro de Oficiais Auxiliares da Marinha (QOAM)</h2>
    <p>Caderno de Prova de Conhecimentos Militares e Navais</p>
  </div>

  <div class="meta-box">
    <span><strong>Matéria / Assunto:</strong> ${exam.category || 'Conhecimentos Gerais'}</span>
    <span><strong>Total:</strong> ${exam.questions.length} Questões</span>
    <span><strong>Data:</strong> ${new Date(exam.createdAt).toLocaleDateString()}</span>
  </div>

  <div class="questions">
    ${exam.questions.map((q, idx) => `
      <div class="question">
        <div class="statement">QUESTÃO ${idx + 1}. ${q.statement}</div>
        <div class="options">
          ${q.options.map(opt => `<div class="option"><strong>(${opt.label})</strong> ${opt.text}</div>`).join('')}
        </div>
      </div>
    `).join('')}
  </div>

  <div class="answer-key-section">
    <h2 style="text-align: center; text-transform: uppercase; font-size: 15pt;">Gabarito Oficial</h2>
    <div class="grid">
      ${exam.questions.map((q, idx) => `
        <div class="grid-item">
          ${idx + 1}: <strong>(${q.correctAnswer})</strong>
        </div>
      `).join('')}
    </div>

    <h3 style="margin-top: 30px; text-transform: uppercase; font-size: 12pt; border-bottom: 1px solid #000; padding-bottom: 5px;">
      Gabarito Comentado e Fundamentação
    </h3>
    ${exam.questions.map((q, idx) => `
      <div class="comment-item">
        <strong>Questão ${idx + 1} [Alternativa ${q.correctAnswer}]:</strong> ${q.explanation}
      </div>
    `).join('')}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Caderno_de_Prova_QOAM_${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyQuestionsText = () => {
    const text = exam.questions.map((q, idx) => {
      const opts = q.options.map(o => `(${o.label}) ${o.text}`).join('\n');
      return `QUESTÃO ${idx + 1}:\n${q.statement}\n${opts}\nGABARITO: (${q.correctAnswer})\nCOMENTÁRIO: ${q.explanation}\n`;
    }).join('\n----------------------------------------\n\n');

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleFinishExam = () => {
    if (unansweredCount > 0 && !showConfirmSubmit) {
      setShowConfirmSubmit(true);
      return;
    }
    setShowConfirmSubmit(false);
    setShowResults(true);
    setIsTimerRunning(false);
    setFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retakeExam = () => {
    setShowResults(false);
    setUserAnswers({});
    setFlaggedQuestions({});
    setCurrentPage(1);
    setTimeLeft(Math.round(defaultSeconds));
    setIsTimerRunning(true);
    setFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retakeIncorrect = () => {
    const newAnswers = { ...userAnswers };
    exam.questions.forEach(q => {
      if (userAnswers[q.id] !== q.correctAnswer) {
        delete newAnswers[q.id];
      }
    });
    setUserAnswers(newAnswers);
    setShowResults(false);
    setIsTimerRunning(true);
    setFilter('unanswered');
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If candidate toggles Paper Mode (On-Screen Printable Exam Sheet)
  if (isPaperMode) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Paper Mode Top Controls */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h3 className="text-base font-black uppercase text-yellow-400 flex items-center gap-2">
              <i className="fa-solid fa-file-invoice"></i> Folha de Prova Oficial (Layout para Impressão)
            </h3>
            <p className="text-xs text-slate-300">
              Visualização formal pronta para imprimir, salvar em PDF ou copiar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wide flex items-center gap-1.5 transition shadow"
            >
              <i className="fa-solid fa-print"></i> Imprimir Prova
            </button>
            <button
              onClick={handleDownloadPrintableHtml}
              className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wide flex items-center gap-1.5 transition shadow"
              title="Baixar arquivo HTML que abre direto para imprimir em qualquer navegador"
            >
              <i className="fa-solid fa-download"></i> Baixar Caderno (PDF/HTML)
            </button>
            <button
              onClick={handleCopyQuestionsText}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-700"
            >
              <i className="fa-solid fa-copy mr-1"></i> {copySuccess ? 'Copiado!' : 'Copiar Texto'}
            </button>
            <button
              onClick={() => setIsPaperMode(false)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-2 rounded-xl text-xs transition"
            >
              Voltar ao Simulado
            </button>
          </div>
        </div>

        {/* Paper Sheet Content */}
        <div className="bg-white p-8 sm:p-14 rounded-2xl shadow-xl border border-gray-300 text-gray-900 font-serif">
          <div className="text-center border-b-2 border-black pb-4 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Marinha do Brasil</h1>
            <h2 className="text-lg font-semibold mt-1">Concurso para o Quadro de Oficiais Auxiliares (QOAM)</h2>
            <p className="text-xs text-gray-600 mt-1 uppercase font-sans">
              Caderno de Questões • {exam.category || 'Conhecimentos Militares'}
            </p>
            <p className="text-xs text-gray-500 italic mt-0.5 font-sans">
              Data: {new Date(exam.createdAt).toLocaleDateString()} • {totalQuestions} Questões de Múltipla Escolha
            </p>
          </div>

          <div className="space-y-6">
            {exam.questions.map((q, index) => (
              <div key={q.id} className="avoid-break pb-4 border-b border-gray-100 last:border-0">
                <p className="font-bold text-sm sm:text-base leading-relaxed mb-2">
                  QUESTÃO {index + 1}. {q.statement}
                </p>
                <div className="ml-4 space-y-1 text-xs sm:text-sm">
                  {q.options.map(opt => (
                    <p key={opt.label} className="leading-relaxed">
                      <strong>({opt.label})</strong> {opt.text}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-4 text-base font-sans">
              Cartão-Resposta / Gabarito Oficial
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-xs font-mono">
              {exam.questions.map((q, index) => (
                <div key={q.id} className="border border-gray-400 p-1 text-center bg-gray-50">
                  <span className="text-gray-600 font-bold">{index + 1}: </span>
                  <strong className="text-black">({q.correctAnswer})</strong>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <h4 className="font-bold uppercase mb-3 text-xs font-sans tracking-wider">
                Gabarito Comentado e Fundamentação:
              </h4>
              <div className="space-y-3 text-xs leading-relaxed text-gray-800">
                {exam.questions.map((q, index) => (
                  <p key={q.id}>
                    <strong>Questão {index + 1} [Gabarito ({q.correctAnswer})]:</strong> {q.explanation}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Print View for native window.print() */}
      <div className="print-only mb-8 text-center border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Marinha do Brasil</h1>
        <h2 className="text-xl font-semibold">Simulado QOAM - Quadro de Oficiais Auxiliares</h2>
        <p className="text-sm mt-1">Título: {exam.title}</p>
        <p className="text-sm">Assunto: {exam.category || 'Conhecimentos Militares e Navais'}</p>
        <p className="text-sm italic">
          Data: {new Date(exam.createdAt).toLocaleDateString()} • Total: {totalQuestions} Questões
        </p>
      </div>

      {/* Main Container */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 no-print">
        {/* Top Header Card */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 border-yellow-500">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-yellow-500 text-slate-950 text-xs font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Simulado QOAM Oficial
              </span>
              <span className="text-xs text-blue-200 font-mono">
                {totalQuestions} Questões de Múltipla Escolha (A a E)
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">{exam.title}</h2>
            <p className="text-sm text-blue-200 mt-0.5">
              {exam.category} {exam.fileName && `• Arquivo: ${exam.fileName}`} {exam.totalPages && `(${exam.totalPages} págs)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Timer Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold ${
              timeLeft < 300 ? 'bg-red-500/20 border-red-500 text-red-200 animate-pulse' : 'bg-blue-900/60 border-blue-700 text-blue-100'
            }`}>
              <i className="fa-solid fa-clock"></i>
              <span>{formatTimer(timeLeft)}</span>
            </div>

            <button
              onClick={() => setShowNavPalette(!showNavPalette)}
              className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-blue-600"
              title="Grade de navegação de questões"
            >
              <i className="fa-solid fa-table-cells"></i>
              <span className="hidden sm:inline">Grade ({totalQuestions})</span>
            </button>

            {/* Print Button (handles popup/iframe restrictions gracefully) */}
            <button
              onClick={handlePrint}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-1.5 shadow"
              title="Imprimir caderno de prova"
            >
              <i className="fa-solid fa-print"></i>
              <span>Imprimir</span>
            </button>

            {/* Dedicated HTML/PDF Download Button */}
            <button
              onClick={handleDownloadPrintableHtml}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-slate-700"
              title="Baixar prova pronta para imprimir em qualquer computador ou salvar em PDF"
            >
              <i className="fa-solid fa-file-pdf text-red-400"></i>
              <span className="hidden sm:inline">Salvar Prova</span>
            </button>

            {/* Layout Paper Toggle */}
            <button
              onClick={() => setIsPaperMode(true)}
              className="bg-slate-800 hover:bg-slate-700 text-blue-200 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-slate-700"
              title="Alternar para visualização de folha de papel impressa"
            >
              <i className="fa-solid fa-eye"></i>
              <span className="hidden sm:inline">Layout Impresso</span>
            </button>

            <button
              onClick={onReset}
              className="bg-red-950 hover:bg-red-900 text-red-200 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition border border-red-800"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="bg-slate-100 px-6 py-3 border-b border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-gray-700 mb-1.5">
            <div className="flex items-center gap-3">
              <span>
                Respondidas: <strong className="text-blue-700">{answeredCount}</strong> / {totalQuestions} ({Math.round((answeredCount / totalQuestions) * 100)}%)
              </span>
              {flaggedCount > 0 && (
                <span className="text-amber-600 flex items-center gap-1">
                  <i className="fa-solid fa-bookmark"></i> {flaggedCount} marcada{flaggedCount > 1 ? 's' : ''} para revisão
                </span>
              )}
            </div>
            <div>
              {unansweredCount > 0 ? (
                <span className="text-gray-500">{unansweredCount} pendente{unansweredCount > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-green-600 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-circle-check"></i> Todas respondidas!
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-700 h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Results Banner when finished */}
        {showResults && (
          <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-200">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900 text-yellow-400 text-2xl mb-3 shadow-md">
                <i className="fa-solid fa-award"></i>
              </div>
              <h3 className="text-2xl font-black navy-text uppercase tracking-tight">Resultado Oficial do Simulado QOAM</h3>
              <p className="text-sm text-gray-600 mt-1">Conforme critérios de avaliação da banca examinadora naval</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Acertos</span>
                  <div className="text-3xl font-black text-green-600 mt-1">{score}</div>
                  <span className="text-xs text-gray-400">de {totalQuestions}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Erros</span>
                  <div className="text-3xl font-black text-red-600 mt-1">{answeredCount - score}</div>
                  <span className="text-xs text-gray-400">questões</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Em Branco</span>
                  <div className="text-3xl font-black text-amber-600 mt-1">{unansweredCount}</div>
                  <span className="text-xs text-gray-400">não marcadas</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Aproveitamento</span>
                  <div className="text-3xl font-black text-blue-700 mt-1">{percentage}%</div>
                  <span className="text-xs font-bold text-gray-600">
                    {parseFloat(percentage) >= 70 ? 'Alto Rendimento' : parseFloat(percentage) >= 50 ? 'Apto' : 'Necessita Revisão'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <button
                  onClick={retakeExam}
                  className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-6 rounded-xl transition shadow flex items-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-rotate-right"></i> Refazer Todo o Simulado
                </button>
                {answeredCount - score > 0 && (
                  <button
                    onClick={retakeIncorrect}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow flex items-center gap-2 text-sm"
                  >
                    <i className="fa-solid fa-filter-circle-xmark"></i> Refazer Questões Erradas ({answeredCount - score})
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-sm shadow"
                >
                  <i className="fa-solid fa-print"></i> Imprimir Gabarito
                </button>
                <button
                  onClick={handleDownloadPrintableHtml}
                  className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-sm border border-gray-300 shadow-sm"
                >
                  <i className="fa-solid fa-file-arrow-down text-blue-700"></i> Baixar Arquivo de Prova (PDF/HTML)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Question Navigator Drawer / Grid */}
        {showNavPalette && (
          <div className="p-6 bg-slate-50 border-b border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">
                <i className="fa-solid fa-table-cells text-blue-800"></i> Grade Geral de Questões (1 a {totalQuestions})
              </h4>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block"></span> Respondida</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> Revisar</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200 inline-block"></span> Pendente</span>
                {showResults && (
                  <>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Certa</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block"></span> Errada</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-2 max-h-56 overflow-y-auto p-2 bg-white rounded-xl border border-gray-200">
              {exam.questions.map(q => {
                const isAnswered = !!userAnswers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                const isCorrect = userAnswers[q.id] === q.correctAnswer;

                let badgeColor = 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
                if (showResults) {
                  if (isCorrect) badgeColor = 'bg-green-600 text-white border-green-700';
                  else if (isAnswered) badgeColor = 'bg-red-500 text-white border-red-600';
                  else badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
                } else {
                  if (isFlagged) badgeColor = 'bg-amber-400 text-amber-950 font-bold border-amber-500 ring-2 ring-amber-300';
                  else if (isAnswered) badgeColor = 'bg-blue-700 text-white font-bold border-blue-800';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => jumpToQuestion(q.id)}
                    className={`h-8 rounded-lg text-xs font-bold border transition flex items-center justify-center relative ${badgeColor}`}
                    title={`Questão ${q.id} ${isAnswered ? `(Marcada: ${userAnswers[q.id]})` : '(Em branco)'}`}
                  >
                    {q.id}
                    {isFlagged && !showResults && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-white"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* View Controls & Filters */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-sm">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase mr-1">Filtrar:</span>
            <button
              onClick={() => { setFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filter === 'all' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              Todas ({totalQuestions})
            </button>
            <button
              onClick={() => { setFilter('unanswered'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filter === 'unanswered' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              Pendentes ({unansweredCount})
            </button>
            <button
              onClick={() => { setFilter('flagged'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filter === 'flagged' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              Revisar ({flaggedCount})
            </button>
            {showResults && (
              <>
                <button
                  onClick={() => { setFilter('incorrect'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filter === 'incorrect' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-red-600 hover:bg-red-50 border border-red-200'
                  }`}
                >
                  Erros ({answeredCount - score})
                </button>
                <button
                  onClick={() => { setFilter('correct'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filter === 'correct' ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
                  }`}
                >
                  Acertos ({score})
                </button>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Visualização:</span>
            <div className="bg-gray-200 p-0.5 rounded-lg flex text-xs">
              <button
                onClick={() => setViewMode('paginated')}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  viewMode === 'paginated' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="10 questões por página"
              >
                Paginada
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  viewMode === 'full' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Todas as questões em lista contínua"
              >
                Lista Contínua
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="p-6 md:p-8 space-y-8">
          {displayedQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <i className="fa-solid fa-filter text-3xl text-gray-300 mb-3"></i>
              <p className="font-semibold text-base">Nenhuma questão encontrada com o filtro selecionado.</p>
              <button
                onClick={() => setFilter('all')}
                className="mt-3 text-sm text-blue-700 font-bold hover:underline"
              >
                Mostrar todas as questões
              </button>
            </div>
          ) : (
            displayedQuestions.map((q) => {
              const isAnswered = !!userAnswers[q.id];
              const isFlagged = !!flaggedQuestions[q.id];
              const isCorrect = userAnswers[q.id] === q.correctAnswer;

              return (
                <div
                  key={q.id}
                  id={`question-anchor-${q.id}`}
                  className={`p-6 rounded-2xl border transition-all ${
                    showResults
                      ? isCorrect
                        ? 'border-green-300 bg-green-50/30'
                        : isAnswered
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-amber-200 bg-amber-50/20'
                      : isFlagged
                      ? 'border-amber-300 bg-amber-50/30 shadow-sm'
                      : isAnswered
                      ? 'border-blue-200 bg-white shadow-sm'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <span className={`font-black text-sm px-3 py-1 rounded-lg text-white shrink-0 ${
                        showResults
                          ? isCorrect
                            ? 'bg-green-600'
                            : 'bg-red-600'
                          : 'navy-bg'
                      }`}>
                        QUESTÃO {q.id}
                      </span>
                      <p className="text-gray-900 font-medium text-base sm:text-lg leading-relaxed pt-0.5">
                        {q.statement}
                      </p>
                    </div>

                    {/* Bookmark / Flag Button */}
                    {!showResults && (
                      <button
                        onClick={() => toggleFlag(q.id)}
                        className={`p-2 rounded-lg transition shrink-0 ${
                          isFlagged
                            ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title={isFlagged ? 'Remover marcação de dúvida' : 'Marcar para revisar depois'}
                      >
                        <i className={`${isFlagged ? 'fa-solid' : 'fa-regular'} fa-bookmark text-base`}></i>
                      </button>
                    )}
                  </div>

                  {/* Options */}
                  <div className="space-y-2.5 sm:ml-12">
                    {q.options.map((opt) => {
                      const isSelected = userAnswers[q.id] === opt.label;
                      const isTheCorrectOption = opt.label === q.correctAnswer;
                      const showCorrectHighlight = showResults && isTheCorrectOption;
                      const showWrongHighlight = showResults && isSelected && !isTheCorrectOption;

                      let optionBorder = 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/40';
                      if (isSelected) optionBorder = 'border-blue-600 bg-blue-50/80 shadow-sm ring-1 ring-blue-500';
                      if (showCorrectHighlight) optionBorder = 'border-green-500 bg-green-50 font-semibold ring-2 ring-green-500';
                      if (showWrongHighlight) optionBorder = 'border-red-500 bg-red-50 ring-2 ring-red-400';

                      return (
                        <label
                          key={opt.label}
                          className={`flex items-start p-3.5 rounded-xl border-2 cursor-pointer transition ${optionBorder}`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            className="mt-1 h-4 w-4 text-blue-700 shrink-0"
                            checked={isSelected}
                            onChange={() => handleOptionChange(q.id, opt.label)}
                            disabled={showResults}
                          />
                          <span className="ml-3 font-bold mr-2 text-slate-900 shrink-0">
                            ({opt.label})
                          </span>
                          <span className="text-gray-800 leading-relaxed text-sm sm:text-base">
                            {opt.text}
                          </span>

                          {showCorrectHighlight && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md shrink-0">
                              <i className="fa-solid fa-check"></i> Correta
                            </span>
                          )}
                          {showWrongHighlight && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md shrink-0">
                              <i className="fa-solid fa-xmark"></i> Sua resposta
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {/* Explanation / Gabarito Comentado */}
                  {showResults && (
                    <div className="mt-5 sm:ml-12 p-4 bg-slate-50 rounded-xl border-l-4 border-yellow-500 text-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black navy-text uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-clipboard-check text-yellow-600"></i> Gabarito Comentado Oficial:
                        </span>
                        <span className="text-xs font-bold text-blue-900 bg-yellow-100 px-2 py-0.5 rounded">
                          Resposta Oficial: ({q.correctAnswer})
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed italic text-xs sm:text-sm">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls when in paginated mode */}
        {viewMode === 'paginated' && totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setCurrentPage(prev => Math.max(1, prev - 1));
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              disabled={safeCurrentPage === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <i className="fa-solid fa-chevron-left"></i> Página Anterior
            </button>

            <span className="text-xs font-semibold text-gray-600">
              Página <strong>{safeCurrentPage}</strong> de <strong>{totalPages}</strong> ({filteredQuestions.length} questões)
            </span>

            <button
              onClick={() => {
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              disabled={safeCurrentPage === totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              Próxima Página <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}

        {/* Bottom Submission Bar */}
        <div className="p-6 bg-slate-900 text-white border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold">
              {showResults
                ? 'Simulado Corrigido com Sucesso'
                : `${answeredCount} de ${totalQuestions} respondidas`}
            </p>
            <p className="text-xs text-slate-400">
              {showResults
                ? `Pontuação final: ${score}/${totalQuestions} (${percentage}%)`
                : unansweredCount > 0
                ? `Ainda restam ${unansweredCount} questões sem resposta.`
                : 'Todas as questões foram preenchidas! Pronto para corrigir.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!showResults ? (
              <button
                onClick={handleFinishExam}
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black py-3 px-8 rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95 uppercase tracking-wider text-sm flex items-center gap-2"
              >
                <i className="fa-solid fa-check-double"></i>
                Corrigir Simulado ({totalQuestions}Q)
              </button>
            ) : (
              <button
                onClick={retakeExam}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition shadow text-sm flex items-center gap-2"
              >
                <i className="fa-solid fa-rotate-right"></i>
                Refazer Simulado
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal when submitting with unanswered questions */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center text-xl mb-4">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-lg font-bold navy-text">Questões Pendentes!</h3>
            <p className="text-sm text-gray-600 mt-2">
              Você ainda possui <strong className="text-amber-600 font-bold">{unansweredCount}</strong> questões não respondidas. Deseja finalizar e corrigir o simulado mesmo assim?
            </p>

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 text-sm transition"
              >
                Voltar e responder
              </button>
              <button
                onClick={() => {
                  setShowConfirmSubmit(false);
                  setShowResults(true);
                  setIsTimerRunning(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-900 text-white font-bold hover:bg-blue-800 text-sm transition"
              >
                Finalizar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View Questions for native window.print() */}
      <div className="print-only">
        {exam.questions.map((q, index) => (
          <div key={q.id} className="mb-6 avoid-break">
            <p className="font-bold mb-2 text-base">
              {index + 1}. {q.statement}
            </p>
            <div className="ml-4 space-y-1 text-sm">
              {q.options.map(opt => (
                <p key={opt.label}>
                  <strong>({opt.label})</strong> {opt.text}
                </p>
              ))}
            </div>
          </div>
        ))}

        <div className="print-break"></div>
        <div className="mt-8 border-t-2 border-black pt-4">
          <h3 className="font-bold uppercase text-center mb-4 text-lg">
            Gabarito Oficial do Simulado ({totalQuestions} Questões)
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-xs font-mono">
            {exam.questions.map((q, index) => (
              <div key={q.id} className="border border-gray-400 p-1 text-center">
                <span className="text-gray-600 font-semibold">{index + 1}: </span>
                <strong className="text-black">({q.correctAnswer})</strong>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-300">
            <h4 className="font-bold uppercase mb-2 text-sm">Gabarito Comentado e Fundamentação:</h4>
            {exam.questions.map((q, index) => (
              <div key={q.id} className="mb-3 text-xs">
                <strong>Q{index + 1} ({q.correctAnswer}):</strong> {q.explanation}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamView;
