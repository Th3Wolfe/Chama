import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  titulo: string;
  subtitulo?: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  footer?: ReactNode;
  largura?: number;
}

/**
 * Painel deslizante fixado à direita da tela — usado para formulários mais
 * ricos (ex: nova/editar categoria, com seletor de ícone) em vez do modal
 * central genérico, que fica apertado pra esse tipo de conteúdo.
 * Fecha com ESC ou clique fora do painel.
 */
export function SlideOver({ titulo, subtitulo, aberto, onFechar, children, footer, largura = 400 }: SlideOverProps) {
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
    <div className="slide-over-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="slide-over" style={{ width: largura }} role="dialog" aria-modal="true">
        <div className="slide-over__header">
          <div>
            <h3 className="slide-over__title">{titulo}</h3>
            {subtitulo && <p className="slide-over__subtitle">{subtitulo}</p>}
          </div>
          <button className="modal__close" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div className="slide-over__body">{children}</div>
        {footer && <div className="slide-over__footer">{footer}</div>}
      </div>
    </div>
  );
}
