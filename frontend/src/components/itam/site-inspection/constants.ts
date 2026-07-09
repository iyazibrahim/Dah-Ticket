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

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const THRESHOLD_LABEL: Record<string, string> = {
  normal: 'Normal',
  warning: 'Warning',
  danger: 'Danger',
};

/** Finding-type opener for the "what is wrong" field. */
const FINDING_TYPE_OPENERS: Record<string, string> = {
  health_check: 'Routine inspection of the device found',
  performance_issue: 'Performance testing during inspection showed',
  hardware_failure: 'Hardware review during inspection showed',
  connectivity_issue: 'Network and connection checks during inspection showed',
  overheating: 'Temperature and heat checks during inspection showed',
  configuration_issue: 'Configuration review during inspection showed',
  replacement_needed: 'Physical condition review during inspection showed',
  other: 'Site inspection observations showed',
};

type SeverityThresholdKey =
  | 'low_normal' | 'low_warning' | 'low_danger'
  | 'medium_normal' | 'medium_warning' | 'medium_danger'
  | 'high_normal' | 'high_warning' | 'high_danger'
  | 'critical_normal' | 'critical_warning' | 'critical_danger';

/** Impact and action templates keyed by severity + threshold. */
const SEVERITY_THRESHOLD_BODY: Record<SeverityThresholdKey, Omit<DescriptionParts, 'what_is_wrong'> & { what_detail: string }> = {
  low_normal: {
    what_detail: 'no major concerns; the device appears generally healthy.',
    impact: 'No noticeable effect on staff or systems at this time.',
    recommended_action: 'Continue regular monitoring. No action needed now.',
  },
  low_warning: {
    what_detail: 'a minor item that should be watched.',
    impact: 'Limited effect; unlikely to disrupt daily work.',
    recommended_action: 'Recheck at the next inspection and note any change.',
  },
  low_danger: {
    what_detail: 'an unexpected reading that needs verification.',
    impact: 'May become a problem if left unchecked.',
    recommended_action: 'Verify the reading and confirm whether follow-up is needed.',
  },
  medium_normal: {
    what_detail: 'the device is working but not fully healthy.',
    impact: 'Some users may notice slower or less reliable performance.',
    recommended_action: 'Schedule a standard check and correction within normal maintenance.',
  },
  medium_warning: {
    what_detail: 'condition is below the expected level.',
    impact: 'Staff may experience intermittent issues at this site.',
    recommended_action: 'Investigate and plan a fix within the next maintenance window.',
  },
  medium_danger: {
    what_detail: 'condition is clearly degraded.',
    impact: 'Operations at this location may be affected if not addressed.',
    recommended_action: 'Arrange inspection and repair as a priority item.',
  },
  high_normal: {
    what_detail: 'a significant problem that needs prompt attention.',
    impact: 'Important services at this site may be disrupted.',
    recommended_action: 'Escalate to IT support and target resolution within 1–2 business days.',
  },
  high_warning: {
    what_detail: 'the situation is poor and worsening.',
    impact: 'Users are likely experiencing noticeable problems now.',
    recommended_action: 'Escalate immediately and assign someone to resolve within 24 hours.',
  },
  high_danger: {
    what_detail: 'the device or system is in a failing state.',
    impact: 'Site operations are at serious risk of interruption.',
    recommended_action: 'Treat as urgent: diagnose and restore service as soon as possible.',
  },
  critical_normal: {
    what_detail: 'failure or imminent failure affecting operations.',
    impact: 'Critical systems at this site are affected or unavailable.',
    recommended_action: 'Respond immediately and restore service before end of business day.',
  },
  critical_warning: {
    what_detail: 'active failure affecting site operations.',
    impact: 'Staff cannot rely on this equipment for normal work.',
    recommended_action: 'Emergency response: assign owner and begin recovery now.',
  },
  critical_danger: {
    what_detail: 'the device is down or unsafe to continue using.',
    impact: 'Major outage or safety risk at this location.',
    recommended_action: 'Emergency action required: isolate, replace, or restore service immediately.',
  },
};

function severityThresholdKey(severity: string, threshold: string): SeverityThresholdKey {
  const key = `${severity}_${threshold}` as SeverityThresholdKey;
  if (key in SEVERITY_THRESHOLD_BODY) return key;
  return 'medium_normal';
}

/** Build description fields from finding type + severity + threshold. */
export function getDescriptionTemplate(
  findingType: string,
  severity: string,
  threshold: string,
): DescriptionParts {
  const opener = FINDING_TYPE_OPENERS[findingType] ?? FINDING_TYPE_OPENERS.other;
  const body = SEVERITY_THRESHOLD_BODY[severityThresholdKey(severity, threshold)];
  return {
    what_is_wrong: `${opener} ${body.what_detail}`,
    impact: body.impact,
    recommended_action: body.recommended_action,
  };
}

/** Human-readable label for the template hint under Insert template. */
export function getDescriptionTemplateLabel(
  findingType: string,
  severity: string,
  threshold: string,
): string {
  const typeLabel = FINDING_TYPE_LABEL[findingType] ?? 'Other';
  const sev = SEVERITY_LABEL[severity] ?? severity;
  const thr = THRESHOLD_LABEL[threshold] ?? threshold;
  return `${typeLabel} · ${sev} · ${thr}`;
}

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
