import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { ChamadoModal } from '../../components/ChamadoModal';

/**
 * Rota dedicada (/chamados/:id) — usada por links diretos: notificações,
 * busca global, "Ver todos" e favoritos. Renderiza o mesmo ChamadoModal
 * usado no Dashboard e em Chamados, garantindo que a visão de um chamado
 * seja sempre a mesma pra admin e usuário, sem depender de duas telas
 * mantidas em paralelo. Ao fechar, volta pra página anterior.
 */
export function ChamadoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <AppLayout titulo="Chamado" subtitulo="Detalhes, comentários, anexos e histórico">
      <ChamadoModal chamadoId={Number(id)} onFechar={() => navigate(-1)} />
    </AppLayout>
  );
}
