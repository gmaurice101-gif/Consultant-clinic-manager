export type UserRole = 'admin' | 'consultant';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  hospitalId?: string;
}

export type PatientType = 'clinic' | 'surgery';
export type PatientStatus = 'booked' | 'attended' | 'no-show';
export type SurgeryStatus = 'not pre-authorized' | 'awaiting preauth approval' | 'pre-authorization approved';

export interface Patient {
  id: string;
  name: string;
  phone: string;
  diagnosis: string;
  hospitalId: string;
  type: PatientType;
  status: PatientStatus;
  surgeryStatus?: SurgeryStatus;
  date: string; // ISO date string
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}

export interface Hospital {
  id: string;
  name: string;
}
