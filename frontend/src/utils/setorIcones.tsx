import type { IconeInfo } from '../components/IconPicker';
import {
  Building2,
  Users,
  Scale,
  Landmark,
  Megaphone,
  Cpu,
  ClipboardList,
  Package,
  Headset,
  Gavel,
  ShieldCheck,
  Wrench,
  Briefcase,
  FileSignature,
  Search,
  Building,
  HeartPulse,
  GraduationCap,
  Handshake,
  Newspaper,
  Truck,
  Calculator,
  BookOpen,
  Store,
  Coins,
} from 'lucide-react';

// Ícones exibidos por padrão no seletor da tela de Setores.
export const SETOR_ICONES_PRINCIPAIS: IconeInfo[] = [
  { chave: 'building-2', Icon: Building2, cor: '#3B82F6' },
  { chave: 'users', Icon: Users, cor: '#22C55E' },
  { chave: 'scale', Icon: Scale, cor: '#A78BFA' },
  { chave: 'landmark', Icon: Landmark, cor: '#F59E0B' },
  { chave: 'megaphone', Icon: Megaphone, cor: '#F472B6' },
  { chave: 'cpu', Icon: Cpu, cor: '#38BDF8' },
  { chave: 'clipboard-list', Icon: ClipboardList, cor: '#FB923C' },
  { chave: 'package', Icon: Package, cor: '#34D399' },
  { chave: 'headset', Icon: Headset, cor: '#C084FC' },
  { chave: 'gavel', Icon: Gavel, cor: '#F87171' },
  { chave: 'shield-check', Icon: ShieldCheck, cor: '#60A5FA' },
  { chave: 'wrench', Icon: Wrench, cor: '#FBBF24' },
  { chave: 'briefcase', Icon: Briefcase, cor: '#818CF8' },
  { chave: 'file-signature', Icon: FileSignature, cor: '#F472B6' },
  { chave: 'search', Icon: Search, cor: '#22D3EE' },
];

// Conjunto adicional, revelado ao clicar em "Mais ícones".
export const SETOR_ICONES_EXTRA: IconeInfo[] = [
  { chave: 'building', Icon: Building, cor: '#60A5FA' },
  { chave: 'heart-pulse', Icon: HeartPulse, cor: '#F87171' },
  { chave: 'graduation-cap', Icon: GraduationCap, cor: '#34D399' },
  { chave: 'handshake', Icon: Handshake, cor: '#FBBF24' },
  { chave: 'newspaper', Icon: Newspaper, cor: '#A78BFA' },
  { chave: 'truck', Icon: Truck, cor: '#FB923C' },
  { chave: 'calculator', Icon: Calculator, cor: '#38BDF8' },
  { chave: 'book-open', Icon: BookOpen, cor: '#4ADE80' },
  { chave: 'store', Icon: Store, cor: '#F472B6' },
  { chave: 'coins', Icon: Coins, cor: '#F5A623' },
];

export const SETOR_ICONES_TODOS = [...SETOR_ICONES_PRINCIPAIS, ...SETOR_ICONES_EXTRA];

const MAPA_ICONES: Record<string, IconeInfo> = Object.fromEntries(SETOR_ICONES_TODOS.map((i) => [i.chave, i]));

export function getSetorIcone(chave?: string | null): IconeInfo {
  return (chave && MAPA_ICONES[chave]) || SETOR_ICONES_PRINCIPAIS[0];
}
