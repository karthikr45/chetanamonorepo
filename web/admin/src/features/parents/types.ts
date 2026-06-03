export type Relationship = "father" | "mother" | "guardian";

export interface ParentStudentLink {
  id: string;
  parentId: string;
  tenantId: string;
  branch: string;
  admissionNumber: string;
  relationship: Relationship;
  isPrimary: boolean;
  createdAt: string;
}

export interface Parent {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  studentLinks: ParentStudentLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateParentInput {
  name: string;
  email: string;
  phoneNumber?: string;
  isActive?: boolean;
  students: {
    branch: string;
    admissionNumber: string;
    relationship?: Relationship;
    isPrimary?: boolean;
  }[];
}
