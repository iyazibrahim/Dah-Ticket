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

export type DescriptionParts = {
  what_is_wrong: string;
  impact: string;
  recommended_action: string;
};

export const EMPTY_DESCRIPTION_PARTS: DescriptionParts = {
  what_is_wrong: '',
  impact: '',
  recommended_action: '',
};

/** Starter text templates keyed by finding type (user can edit after insert). */
export const DESCRIPTION_TEMPLATES: Record<string, DescriptionParts> = {
  health_check: {
    what_is_wrong: 'Routine check found the device is not operating as expected.',
    impact: 'Site operations may be affected until this is checked and confirmed.',
    recommended_action: 'Inspect the device, confirm status, and note any follow-up needed.',
  },
  performance_issue: {
    what_is_wrong: 'The device is running slower or less reliably than expected.',
    impact: 'Users at this location may experience delays or limited capability.',
    recommended_action: 'Review load and settings, then correct or escalate if it continues.',
  },
  hardware_failure: {
    what_is_wrong: 'Hardware appears damaged, failed, or no longer working properly.',
    impact: 'Service at this location is reduced or unavailable until repaired or replaced.',
    recommended_action: 'Arrange repair or replacement and update asset records when done.',
  },
  connectivity_issue: {
    what_is_wrong: 'Network connection is unstable, intermittent, or unavailable.',
    impact: 'Staff and systems at this site may lose access to online services.',
    recommended_action: 'Check cabling, ports, and wireless coverage; restore the connection.',
  },
  overheating: {
    what_is_wrong: 'The device is running hotter than normal during inspection.',
    impact: 'Continued heat may cause downtime or shorten the life of the equipment.',
    recommended_action: 'Improve cooling/ventilation and re-check temperature after changes.',
  },
  configuration_issue: {
    what_is_wrong: 'Device settings do not match the expected or approved configuration.',
    impact: 'Incorrect settings may cause security, access, or reliability problems.',
    recommended_action: 'Apply the correct configuration and verify the device after the change.',
  },
  replacement_needed: {
    what_is_wrong: 'This equipment is no longer suitable for continued use at the site.',
    impact: 'Leaving it in place risks further outages and higher support effort.',
    recommended_action: 'Plan replacement, remove the old unit from inventory when swapped.',
  },
  other: {
    what_is_wrong: 'Describe what was observed during the site inspection.',
    impact: 'Describe how this affects staff, systems, or site operations.',
    recommended_action: 'Describe the recommended next steps.',
  },
};

const DESC_SECTION_WRONG = 'What is wrong:';
const DESC_SECTION_IMPACT = 'Impact:';
const DESC_SECTION_ACTION = 'Recommended action:';

export function composeDescription(parts: DescriptionParts): string {
  const blocks: string[] = [];
  const wrong = parts.what_is_wrong.trim();
  const impact = parts.impact.trim();
  const action = parts.recommended_action.trim();
  if (wrong) blocks.push(`${DESC_SECTION_WRONG}\n${wrong}`);
  if (impact) blocks.push(`${DESC_SECTION_IMPACT}\n${impact}`);
  if (action) blocks.push(`${DESC_SECTION_ACTION}\n${action}`);
  return blocks.join('\n\n');
}

export function parseDescription(text: string): DescriptionParts {
  const raw = (text || '').trim();
  if (!raw) return { ...EMPTY_DESCRIPTION_PARTS };

  const hasMarkers =
    raw.includes(DESC_SECTION_WRONG) ||
    raw.includes(DESC_SECTION_IMPACT) ||
    raw.includes(DESC_SECTION_ACTION);

  if (!hasMarkers) {
    return { what_is_wrong: raw, impact: '', recommended_action: '' };
  }

  const extract = (label: string, nextLabels: string[]): string => {
    const start = raw.indexOf(label);
    if (start < 0) return '';
    let end = raw.length;
    for (const next of nextLabels) {
      const idx = raw.indexOf(next, start + label.length);
      if (idx >= 0 && idx < end) end = idx;
    }
    return raw.slice(start + label.length, end).trim();
  };

  return {
    what_is_wrong: extract(DESC_SECTION_WRONG, [DESC_SECTION_IMPACT, DESC_SECTION_ACTION]),
    impact: extract(DESC_SECTION_IMPACT, [DESC_SECTION_ACTION, DESC_SECTION_WRONG]),
    recommended_action: extract(DESC_SECTION_ACTION, [DESC_SECTION_WRONG, DESC_SECTION_IMPACT]),
  };
}

export const EMPTY_FINDING_FORM = {
  device_title: '',
  asset_type_label: '',
  finding_type: 'health_check',
  severity: 'medium',
  threshold_state: 'normal',
  what_is_wrong: '',
  impact: '',
  recommended_action: '',
};

export type InspectionStep = 'location' | 'findings' | 'report';

export type FindingFormState = typeof EMPTY_FINDING_FORM;
