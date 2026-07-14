import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';

export interface IconeInfo {
  chave: string;
  Icon: LucideIcon;
  cor: string;
}

export function IconPicker({
  principais,
  extras,
  selecionado,
  onSelecionar,
}: {
  principais: IconeInfo[];
  extras: IconeInfo[];
  selecionado: string;
  onSelecionar: (chave: string) => void;
}) {
  const [mostrarMais, setMostrarMais] = useState(false);
  const icones = mostrarMais ? [...principais, ...extras] : principais;

  return (
    <div className="icon-picker">
      <div className="icon-picker__grid">
        {icones.map(({ chave, Icon, cor }) => {
          const ativo = chave === selecionado;
          return (
            <button
              type="button"
              key={chave}
              className={`icon-picker__item ${ativo ? 'icon-picker__item--ativo' : ''}`}
              style={{ background: `${cor}26`, color: cor }}
              onClick={() => onSelecionar(chave)}
              aria-label={chave}
              aria-pressed={ativo}
            >
              <Icon size={20} strokeWidth={2} />
              {ativo && (
                <span className="icon-picker__check">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!mostrarMais && extras.length > 0 && (
        <button type="button" className="icon-picker__mais" onClick={() => setMostrarMais(true)}>
          Mais ícones
        </button>
      )}
    </div>
  );
}
