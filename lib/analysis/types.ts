// ============================================================
// 📁 فایل: lib/analysis/types.ts
// ============================================================
export type {
  Severity,
  Confidence,
  AuditType,
  AuditStatus,
  FindingCategory,
  EvidenceItem,
  AuditFinding,
  AuditScorecard,
  AdvancedAuditResult,
} from '@/types';

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  relatedLines: number[];
  expectedCoverage: string;
}

export interface AuditValidationResult {
  structurallyValid: boolean;
  semanticallyComplete: boolean;
  issues: ValidationIssue[];
  repairRequired: boolean;
}

export interface DetectorSignal {
  type: string;
  value: string;
  line: number;
  weight: number;
}

export interface DetectorResult {
  requiresConcurrencyAudit: boolean;
  score: number;
  signals: DetectorSignal[];
}