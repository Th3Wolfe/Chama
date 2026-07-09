import { Modal } from './Modal';

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  perigo?: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Substitui os window.confirm() nativos por um diálogo no mesmo estilo visual
 * do resto do app — usado nas ações de excluir/desativar em Usuários e Equipamentos.
 */
export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  perigo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  return (
    <Modal titulo={titulo} aberto={aberto} onFechar={onCancelar} largura={380}>
      {descricao && <p className="modal__text">{descricao}</p>}
      <div className="modal__actions">
        <button className="btn btn--secondary" disabled={carregando} onClick={onCancelar}>
          {cancelarLabel}
        </button>
        <button
          className={`btn ${perigo ? 'btn--danger-solid' : 'btn--primary'}`}
          disabled={carregando}
          onClick={onConfirmar}
        >
          {carregando ? 'Aguarde...' : confirmarLabel}
        </button>
      </div>
    </Modal>
  );
}
