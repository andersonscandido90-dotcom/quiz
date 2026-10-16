import React, { useState, useEffect } from 'react';
import { getStoredApiKey, saveStoredApiKey } from '../services/geminiService';

const Header: React.FC = () => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState(false);

  useEffect(() => {
    const key = getStoredApiKey();
    setHasKey(!!key);
    if (key) setApiKeyInput(key);
  }, []);

  const handleSaveKey = () => {
    saveStoredApiKey(apiKeyInput.trim());
    setHasKey(!!apiKeyInput.trim());
    setShowKeyModal(false);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKeyInput(text.trim());
        setPasteFeedback(true);
        setTimeout(() => setPasteFeedback(false), 2000);
      }
    } catch (e) {
      console.warn('Não foi possível ler a área de transferência automaticamente:', e);
    }
  };

  return (
    <header className="navy-bg text-white py-5 px-4 shadow-lg border-b-4 border-yellow-500 no-print">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-white p-2.5 rounded-2xl shadow-inner">
            <i className="fa-solid fa-anchor text-2xl navy-text"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase">Marinha do Brasil</h1>
              <span className="text-[10px] bg-yellow-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                QOAM
              </span>
            </div>
            <p className="text-xs sm:text-sm font-light text-blue-200">Simulador de Provas e Mapas Mentais com IA</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeyModal(true)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              hasKey
                ? 'bg-green-900/60 border-green-500 text-green-200 hover:bg-green-800/80'
                : 'bg-blue-900/60 border-blue-600 text-blue-200 hover:bg-blue-800/80 animate-pulse'
            }`}
            title="Configurar chave do Google Gemini (para uso na Vercel)"
          >
            <i className="fa-solid fa-key text-yellow-400"></i>
            <span>{hasKey ? 'Chave Gemini Configurada' : 'Como Obter / Inserir Chave Gemini'}</span>
          </button>

          <div className="text-right hidden md:block border-l border-blue-800/60 pl-3">
            <p className="text-[10px] font-mono uppercase text-blue-300">Quadro de Oficiais Auxiliares</p>
            <p className="text-base font-black gold-text tracking-widest">ADSUMUS</p>
          </div>
        </div>
      </div>

      {/* API Key Modal & Tutorial */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-black navy-text uppercase flex items-center gap-2">
                <i className="fa-solid fa-key text-yellow-500"></i> Como Saber ou Criar sua Chave Gemini
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Não se preocupe se não lembra da chave antiga: <strong>o Google não exibe a chave completa após a criação por segurança</strong>, mas gerar uma nova leva <strong>menos de 30 segundos</strong> e é 100% gratuita!
            </p>

            {/* Quick 3-Step Guide */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong>Acesse o Google AI Studio:</strong> Entre com sua conta Google (mesma do Gmail).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  Clique no botão azul <strong>"Create API key"</strong> (ou "Criar chave de API") e escolha qualquer projeto.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  Clique em <strong>Copy</strong> (Copiar) e cole no campo abaixo.
                </div>
              </div>
            </div>

            {/* Direct Link Button */}
            <div className="mb-4">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Abrir Google AI Studio para Copiar Nova Chave</span>
              </a>
            </div>

            {/* Input & Paste */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Cole sua Chave Aqui (Começa com AIzaSy...):
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-[11px] font-bold text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <i className="fa-solid fa-paste"></i>
                    {pasteFeedback ? 'Colado!' : 'Colar da área de transferência'}
                  </button>
                </div>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Cole aqui: AIzaSy..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * A chave fica salva de forma segura e exclusiva no armazenamento local do seu navegador (localStorage).
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              {hasKey && (
                <button
                  type="button"
                  onClick={() => {
                    saveStoredApiKey('');
                    setApiKeyInput('');
                    setHasKey(false);
                    setShowKeyModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition mr-auto"
                >
                  Remover Chave
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={!apiKeyInput.trim()}
                className={`py-2 px-6 rounded-xl text-xs uppercase tracking-wider font-bold transition ${
                  apiKeyInput.trim()
                    ? 'bg-blue-900 hover:bg-blue-800 text-white cursor-pointer shadow'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Salvar Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
