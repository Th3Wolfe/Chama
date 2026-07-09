import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  titulo: string;
  subtitulo?: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  largura?: number;
}

/**
 * Modal genérico usado pelas telas administrativas (Usuários, Equipamentos, ...)
 * pra edição em formulário de verdade, em vez de campos soltos editáveis na tabela.
 * Fecha com ESC ou clique no fundo.
 */
export function Modal({ titulo, subtitulo, aberto, onFechar, children, largura = 420 }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="modal" style={{ width: largura }} role="dialog" aria-modal="true">
        <div className="modal__header">
          <div>
            <h3 className="modal__title">{titulo}</h3>
            {subtitulo && <p className="modal__subtitle">{subtitulo}</p>}
          </div>
          <button className="modal__close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
