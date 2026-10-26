import type { Language, StaffModule, StaffRole } from '@/engine/types';

/**
 * DEMO staff-training fixtures: the staff course catalogue and seed staff per partner.
 * PHASE-2: real logic goes here — an LMS (or the backend) owns staff, assignments and scores.
 */
export const STAFF_PASS_MARK = 70;

export const staffCatalog: StaffModule[] = [
  { id: 'S1', title: 'Welcome & brand story', hours: 1, forRoles: ['Store manager', 'Optometrist', 'Sales associate'] },
  { id: 'S2', title: 'Eye test basics', hours: 4, forRoles: ['Optometrist'] },
  { id: 'S3', title: 'Frame styling & fitting', hours: 2, forRoles: ['Optometrist', 'Sales associate'] },
  { id: 'S4', title: 'POS & billing', hours: 2, forRoles: ['Store manager', 'Sales associate'] },
  { id: 'S5', title: 'Customer service & returns', hours: 2, forRoles: ['Sales associate', 'Store manager'] },
  { id: 'S6', title: 'Opening & closing checklist', hours: 1, forRoles: ['Store manager'] },
  { id: 'S7', title: 'Inventory & stock counts', hours: 2, forRoles: ['Store manager'] },
];

/** Seed staff names by partner language (demo). */
export const seedStaffNames: Record<Language, Array<[string, StaffRole]>> = {
  Kannada: [
    ['Prakash M', 'Store manager'],
    ['Dr. Shwetha K', 'Optometrist'],
    ['Manoj R', 'Sales associate'],
  ],
  Hindi: [
    ['Rakesh Yadav', 'Store manager'],
    ['Dr. Pooja Saini', 'Optometrist'],
    ['Aman Verma', 'Sales associate'],
  ],
  English: [
    ['Leon Pereira', 'Store manager'],
    ['Dr. Nisha Thomas', 'Optometrist'],
    ['Joel Fernandes', 'Sales associate'],
  ],
};
