import React, { useState, useEffect } from 'react';
import { getStoredApiKey, saveStoredApiKey } from '../services/geminiService';

const Header: React.FC = () => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);

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
                : 'bg-blue-900/60 border-blue-600 text-blue-200 hover:bg-blue-800/80'
            }`}
            title="Configurar chave do Google Gemini (para uso na Vercel)"
          >
            <i className="fa-solid fa-key text-yellow-400"></i>
            <span>{hasKey ? 'Chave Gemini Ativa' : 'Configurar Chave Gemini'}</span>
          </button>

          <div className="text-right hidden md:block border-l border-blue-800/60 pl-3">
            <p className="text-[10px] font-mono uppercase text-blue-300">Quadro de Oficiais Auxiliares</p>
            <p className="text-base font-black gold-text tracking-widest">ADSUMUS</p>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-black navy-text uppercase flex items-center gap-2">
                <i className="fa-solid fa-key text-yellow-500"></i> Chave do Google Gemini (Vercel)
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
              Ao hospedar na <strong>Vercel</strong>, o simulador pode operar diretamente no seu navegador, sem limites de tempo de servidor (eliminando o erro <code>FUNCTION_INVOCATION_FAILED</code>).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Sua Chave de API do Gemini (Gratuita):
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-[11px] text-blue-900 leading-normal flex items-start gap-2">
                <i className="fa-solid fa-circle-info text-blue-700 mt-0.5 shrink-0"></i>
                <span>
                  Obtenha sua chave gratuita em segundos no{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-blue-800 hover:text-blue-950"
                  >
                    Google AI Studio (Clique aqui)
                  </a>
                  . A chave fica salva apenas no seu navegador.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {hasKey && (
                <button
                  type="button"
                  onClick={() => {
                    saveStoredApiKey('');
                    setApiKeyInput('');
                    setHasKey(false);
                    setShowKeyModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition"
                >
                  Remover
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-xl text-xs uppercase tracking-wider transition"
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
