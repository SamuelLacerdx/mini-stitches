import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const mostrarToast = useCallback((texto, tipo = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, texto, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[fadeIn_0.2s_ease-out] ${
              t.tipo === 'sucesso'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : t.tipo === 'erro'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-[#FEF8F0] border border-orange-300 text-[#3E2417]'
            }`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
