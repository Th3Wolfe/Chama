import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { RequireAdmin } from './components/RequireAdmin';
import { Dashboard } from './pages/Dashboard';
import { ChamadosList } from './pages/Chamados/ChamadosList';
import { NovoChamado } from './pages/Chamados/NovoChamado';
import { ChamadoDetail } from './pages/Chamados/ChamadoDetail';
import { Categorias } from './pages/Categorias';
import { Setores } from './pages/Setores';
import { Equipamentos } from './pages/Equipamentos';
import { Usuarios } from './pages/Usuarios';
import { Relatorios } from './pages/Relatorios';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RequireAuth>
          <Routes>
            <Route path="/" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
            <Route path="/chamados" element={<ChamadosList />} />
            <Route path="/chamados/novo" element={<NovoChamado />} />
            <Route path="/chamados/:id" element={<ChamadoDetail />} />
            <Route path="/categorias" element={<RequireAdmin><Categorias /></RequireAdmin>} />
            <Route path="/setores" element={<RequireAdmin><Setores /></RequireAdmin>} />
            <Route path="/equipamentos" element={<RequireAdmin><Equipamentos /></RequireAdmin>} />
            <Route path="/usuarios" element={<RequireAdmin><Usuarios /></RequireAdmin>} />
            <Route path="/relatorios" element={<RequireAdmin><Relatorios /></RequireAdmin>} />
          </Routes>
        </RequireAuth>
      </AuthProvider>
    </BrowserRouter>
  );
}
