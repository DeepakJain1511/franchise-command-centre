import {
  GanttChartSquare, Hexagon, Inbox, KanbanSquare, LayoutDashboard, Map, MessageSquareText, Settings, ShieldCheck, Store, Upload, Users, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The one question this screen answers (shown as the page subtitle). */
  question: string;
  filters: boolean;
}

export const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, question: 'Where do we stand?', filters: true },
  { to: '/map', label: 'Territory map', icon: Map, question: 'Where are we growing?', filters: true },
  { to: '/applicants', label: 'Applicants', icon: Users, question: 'Who are they, what happened?', filters: true },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare, question: 'Where is everyone in the journey?', filters: true },
  { to: '/territories', label: 'Territories', icon: Hexagon, question: 'How full is each territory?', filters: true },
  { to: '/onboarding', label: 'Onboarding', icon: GanttChartSquare, question: 'How do partners get to open?', filters: true },
  { to: '/ask', label: 'Ask & What-if', icon: MessageSquareText, question: 'Why X? What if Y?', filters: false },
  { to: '/inbox', label: 'Partner inbox', icon: Inbox, question: 'What are partners asking?', filters: false },
  { to: '/checks', label: 'Checks', icon: ShieldCheck, question: 'Is every decision by the rules?', filters: false },
];

export const NAV_FOOTER: NavItem[] = [
  { to: '/', label: 'Upload data', icon: Upload, question: 'Start', filters: false },
  { to: '/partner', label: 'Partner portal', icon: Store, question: 'What partners see', filters: false },
  { to: '/settings', label: 'Settings', icon: Settings, question: 'Demo controls', filters: false },
];
