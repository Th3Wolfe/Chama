import type { IconeInfo } from '../components/IconPicker';
import {
  Monitor,
  Code2,
  Wifi,
  ShieldCheck,
  Printer,
  Database,
  Cloud,
  Laptop,
  Smartphone,
  Headphones,
  Users,
  Settings,
  Folder,
  KeyRound,
  Tag,
  Server,
  HardDrive,
  Router,
  Camera,
  Mail,
  Lock,
  Globe,
  Battery,
  Bell,
  FileText,
} from 'lucide-react';

export type CategoriaIconeInfo = IconeInfo;

// Ícones exibidos por padrão no seletor da tela de Categorias.
export const CATEGORIA_ICONES_PRINCIPAIS: CategoriaIconeInfo[] = [
  { chave: 'monitor', Icon: Monitor, cor: '#3B82F6' },
  { chave: 'code', Icon: Code2, cor: '#22C55E' },
  { chave: 'wifi', Icon: Wifi, cor: '#A78BFA' },
  { chave: 'shield', Icon: ShieldCheck, cor: '#F87171' },
  { chave: 'printer', Icon: Printer, cor: '#F472B6' },
  { chave: 'database', Icon: Database, cor: '#F59E0B' },
  { chave: 'cloud', Icon: Cloud, cor: '#38BDF8' },
  { chave: 'laptop', Icon: Laptop, cor: '#34D399' },
  { chave: 'smartphone', Icon: Smartphone, cor: '#818CF8' },
  { chave: 'headphones', Icon: Headphones, cor: '#C084FC' },
  { chave: 'users', Icon: Users, cor: '#FB7185' },
  { chave: 'settings', Icon: Settings, cor: '#22D3EE' },
  { chave: 'folder', Icon: Folder, cor: '#FBBF24' },
  { chave: 'key', Icon: KeyRound, cor: '#A78BFA' },
  { chave: 'tag', Icon: Tag, cor: '#F472B6' },
];

// Conjunto adicional, revelado ao clicar em "Mais ícones".
export const CATEGORIA_ICONES_EXTRA: CategoriaIconeInfo[] = [
  { chave: 'server', Icon: Server, cor: '#60A5FA' },
  { chave: 'hard-drive', Icon: HardDrive, cor: '#F59E0B' },
  { chave: 'router', Icon: Router, cor: '#A78BFA' },
  { chave: 'camera', Icon: Camera, cor: '#34D399' },
  { chave: 'mail', Icon: Mail, cor: '#38BDF8' },
  { chave: 'lock', Icon: Lock, cor: '#F87171' },
  { chave: 'globe', Icon: Globe, cor: '#22D3EE' },
  { chave: 'battery', Icon: Battery, cor: '#4ADE80' },
  { chave: 'bell', Icon: Bell, cor: '#FBBF24' },
  { chave: 'file-text', Icon: FileText, cor: '#818CF8' },
];

export const CATEGORIA_ICONES_TODOS = [...CATEGORIA_ICONES_PRINCIPAIS, ...CATEGORIA_ICONES_EXTRA];

const MAPA_ICONES: Record<string, CategoriaIconeInfo> = Object.fromEntries(
  CATEGORIA_ICONES_TODOS.map((i) => [i.chave, i])
);

export function getCategoriaIcone(chave?: string | null): CategoriaIconeInfo {
  return (chave && MAPA_ICONES[chave]) || CATEGORIA_ICONES_PRINCIPAIS[0];
}
