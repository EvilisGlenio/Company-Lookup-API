export type CompanyStatus =
  "ACTIVE" | "SUSPENDED" | "UNFIT" | "CLOSED" | "NULL" | "UNKNOWN";
export type CompanySize =
  "MICRO_COMPANY" | "SMALL_COMPANY" | "OTHER" | "UNINFORMED" | "UNKNOWN";
export type VehicleSegment = "CAR_OR_LIGHT_VEHICLE" | "MOTORCYCLE";
export type CompanySource = "BRASIL_API";

export interface BusinessActivity {
  code: string;
  description: string;
}

export interface MatchedActivity extends BusinessActivity {
  isPrimary: boolean;
}

export interface WorkshopClassification {
  isLikelyWorkshop: boolean;
  vehicleSegments: VehicleSegment[];
  matchedActivities: MatchedActivity[];
}

export interface LegalNature {
  code: string;
  description: string;
}

export interface Phone {
  areaCode: string;
  number: string;
}

export interface Address {
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

// Dados cadastrais normalizados, sem classificação nem metadados da consulta.
export interface Company {
  taxId: string;
  legalName: string;
  tradeName: string | null;
  status: CompanyStatus;
  // YYYY-MM-DD
  openedAt: string | null;
  legalNature: LegalNature | null;
  companySize: CompanySize;
  shareCapital: number | null;
  email: string | null;
  phone: Phone | null;
  address: Address;
  primaryActivity: BusinessActivity | null;
  secondaryActivities: BusinessActivity[];
}

// O que o provedor entrega: a empresa antes de classificação e metadados.
export type ProviderCompany = Company;

export interface CompanyLookupResult extends Company {
  workshop: WorkshopClassification;
  metadata: {
    source: CompanySource;
    cached: boolean;
    // ISO 8601 da consulta original ao provedor.
    fetchedAt: string;
  };
}
