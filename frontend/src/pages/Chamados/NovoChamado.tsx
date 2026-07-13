import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { NovoChamadoModal } from '../../components/NovoChamadoModal';

/**
 * Rota dedicada (/chamados/novo) — usada pelo link do menu lateral e por
 * links diretos/favoritos. Renderiza o mesmo modal usado no Dashboard e em
 * Chamados, sobre o layout padrão, e volta pra página anterior ao fechar.
 */
export function NovoChamado() {
  const navigate = useNavigate();

  return (
    <AppLayout titulo="Novo chamado" subtitulo="Descreva o problema que você está enfrentando">
      <NovoChamadoModal
        onFechar={() => navigate(-1)}
        onCriado={(id) => navigate(`/chamados/${id}`)}
      />
    </AppLayout>
  );
}
