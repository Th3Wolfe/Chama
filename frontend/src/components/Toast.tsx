import { useEffect, useState } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export interface ToastItem {
  id: string;
  titulo: string;
  descricao: string;
  cor: string;
  icone?: LucideIcon;
  onClick?: () => void;
}

let pushToastExterno: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

/** Dispara um toast de qualquer lugar do app, sem precisar prop-drilling. */
export function pushToast(toast: Omit<ToastItem, 'id'>) {
  pushToastExterno?.(toast);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToastExterno = (toast) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((atual) => [...atual, { ...toast, id }]);
    };
    return () => {
      pushToastExterno = null;
    };
  }, []);

  function remover(id: string) {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast" style={{ borderLeftColor: t.cor }}>
          {t.icone && (
            <div className="toast__icone" style={{ background: `${t.cor}1A`, color: t.cor }}>
              <t.icone size={16} strokeWidth={2.25} />
            </div>
          )}
          <div style={{ flex: 1, cursor: t.onClick ? 'pointer' : 'default' }} onClick={t.onClick}>
            <p className="toast__title">{t.titulo}</p>
            <p className="toast__desc">{t.descricao}</p>
          </div>
          <button className="toast__close" onClick={() => remover(t.id)} aria-label="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
