import { Cpu, Wifi, Wrench } from 'lucide-react';

export const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

export const THRESHOLD_COLOR: Record<string, string> = {
  normal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  danger: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

export const FINDING_TYPES = [
  { key: 'health_check', label: 'Health Check' },
  { key: 'performance_issue', label: 'Performance Issue' },
  { key: 'hardware_failure', label: 'Hardware Failure' },
  { key: 'connectivity_issue', label: 'Connectivity Issue' },
  { key: 'overheating', label: 'Overheating' },
  { key: 'configuration_issue', label: 'Configuration Issue' },
  { key: 'replacement_needed', label: 'Replacement Needed' },
  { key: 'other', label: 'Other' },
] as const;

export const FINDING_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FINDING_TYPES.map(({ key, label }) => [key, label]),
);

export const DEVICE_TYPES = [
  { key: 'switch', label: 'Switch', Icon: Wifi },
  { key: 'router', label: 'Router', Icon: Wifi },
  { key: 'access_point', label: 'Access Point', Icon: Wifi },
  { key: 'pc', label: 'PC / Desktop', Icon: Cpu },
  { key: 'laptop', label: 'Laptop', Icon: Cpu },
  { key: 'other', label: 'Other', Icon: Wrench },
] as const;

export const EMPTY_FINDING_FORM = {
  device_title: '',
  asset_type_label: '',
  finding_type: 'health_check',
  severity: 'medium',
  threshold_state: 'normal',
  description: '',
};

export type InspectionStep = 'location' | 'findings' | 'report';

export type FindingFormState = typeof EMPTY_FINDING_FORM;
