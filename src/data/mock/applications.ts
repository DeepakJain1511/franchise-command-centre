import type { Application, City, Floor, Language, SpaceAvailable } from '@/engine/types';

/**
 * 40 deterministic demo applications. Messy / contradictory cases are on purpose:
 *  - APP-019, APP-030: "Owned" space with blank size
 *  - APP-035: "Upper floor, 120 sq ft"
 *  - APP-031, APP-020: launch in 1 month with no space identified
 *  - APP-030: 0 years experience, ₹1.8 Cr capacity
 *  - APP-040, APP-020: mixed-language / typo notes
 *  - APP-003 vs APP-029: duplicate-ish names
 *  - APP-024, APP-023: target a PIN that already has a store
 *  - 560037, 560102, 560068: two applicants on the same PIN
 *  - APP-032 (Belagavi 590019), APP-039/APP-040 (Davanagere): PIN in no territory
 *  - APP-016: Ground floor but space "Not yet identified"
 */
type Row = [
  id: string,
  name: string,
  city: City,
  pin: string,
  investmentLakh: number,
  experienceYears: number,
  business: string,
  space: SpaceAvailable,
  spaceSqft: number | null,
  floor: Floor,
  launchMonths: number,
  language: Language,
  notes: string,
  submittedAt: string,
];

const rows: Row[] = [
  ['APP-001', 'Rajesh Agarwal', 'Bengaluru', '560037', 85, 9, 'Optical store owner, 2 outlets', 'Owned', 650, 'Ground', 3, 'Hindi', 'Ready to start asap', '2026-08-04'],
  ['APP-002', 'Shruthi Hegde', 'Bengaluru', '560048', 60, 6, 'Pharmacy franchisee', 'Rented', 500, 'Ground', 4, 'Kannada', 'Shop is on main road near metro', '2026-08-06'],
  ['APP-003', 'Ravi Kumar Gowda', 'Mysuru', '570002', 60, 7, 'Textile shop, Devaraja market', 'Owned', 600, 'Ground', 3, 'Kannada', 'Family building, ground floor free from Dec', '2026-08-08'],
  ['APP-004', 'Manjunath Shetty', 'Bengaluru', '560092', 80, 11, 'Supermarket owner', 'Owned', 900, 'Ground', 4, 'Kannada', '', '2026-08-11'],
  ['APP-005', 'Kavya Rao', 'Bengaluru', '560102', 95, 10, 'Optical counters in 2 clinics', 'Owned', 700, 'Ground', 2, 'Kannada', 'Already have optometrist on staff', '2026-08-12'],
  ['APP-006', 'David Pinto', 'Mangaluru', '575003', 70, 8, 'Electronics showroom', 'Owned', 750, 'Ground', 3, 'English', 'Hampankatta junction, corner unit', '2026-08-14'],
  ['APP-007', 'Vikram Singh', 'Bengaluru', '560068', 40, 6, 'Apparel store manager', 'Rented', 350, 'Upper', 3, 'Hindi', 'First floor above a bank, good footfall', '2026-08-19'],
  ['APP-008', 'Anitha Murthy', 'Mysuru', '570020', 75, 9, 'Ex-bank manager, runs pharmacy', 'Rented', 550, 'Ground', 5, 'Kannada', '', '2026-06-15'],
  ['APP-009', 'Arjun Menon', 'Bengaluru', '560103', 120, 12, 'Ex-retail ops manager, watch brand', 'Rented', 800, 'Mall unit', 2, 'English', 'Mall leasing team already in talks', '2026-06-18'],
  ['APP-010', 'Lakshmi Narayan', 'Bengaluru', '560078', 150, 14, 'Jewellery retail, family business', 'Owned', 1200, 'Ground', 6, 'Kannada', 'Can do larger format store', '2026-08-25'],
  ['APP-011', 'Prakash Patil', 'Hubballi-Dharwad', '580029', 65, 10, 'Hardware store', 'Owned', 650, 'Ground', 4, 'Kannada', '', '2026-08-27'],
  ['APP-012', 'Amit Jain', 'Bengaluru', '560024', 70, 8, 'Watch & optical store manager', 'Not yet identified', null, 'Not known', 3, 'Hindi', 'Looking near Hebbal flyover, ground floor pref', '2026-09-01'],
  ['APP-013', 'Priya Gupta', 'Bengaluru', '560041', 30, 4, 'Saree boutique', 'Rented', 300, 'Upper', 8, 'Hindi', '', '2026-09-02'],
  ['APP-014', 'Sunita Mehta', 'Mysuru', '570008', 40, 4, 'Gift shop', 'Rented', 400, 'Ground', 6, 'Hindi', 'Near Agrahara circle', '2026-09-04'],
  ['APP-015', 'Naveen Reddy', 'Bengaluru', '560036', 35, 3, 'Mobile accessories shop', 'Rented', 380, 'Ground', 6, 'Kannada', '', '2026-09-08'],
  ['APP-016', 'Harish Bhat', 'Bengaluru', '560100', 50, 7, 'Bakery chain franchisee', 'Not yet identified', null, 'Ground', 2, 'Kannada', 'Ground floor confirmed, location finalising', '2026-09-09'],
  ['APP-017', 'Rekha Nayak', 'Mangaluru', '575002', 55, 6, 'Optical shop assistant, 6 yrs', 'Rented', 450, 'Ground', 4, 'Kannada', '', '2026-09-11'],
  ['APP-018', 'Neha Sharma', 'Bengaluru', '560087', 45, 2, '', 'Not yet identified', null, 'Not known', 5, 'Hindi', '', '2026-09-15'],
  ['APP-019', 'Girish Hiremath', 'Mysuru', '570011', 50, 6, 'Mobile store', 'Owned', null, 'Ground', 2, 'Kannada', 'Own building on main road', '2026-09-16'],
  ['APP-020', 'Santosh Hosamani', 'Hubballi-Dharwad', '580031', 30, 2, 'Kirana store', 'Not yet identified', null, 'Ground', 1, 'Kannada', '1 month alli open madbeku, space hudukta iddini', '2026-09-18'],
  ['APP-021', 'Chaitra Joshi', 'Bengaluru', '560064', 40, 3, 'Cosmetics retail', 'Rented', 420, 'Upper', 5, 'Kannada', '', '2026-09-22'],
  ['APP-022', 'Rahul Mathew', 'Bengaluru', '560062', 20, 1, 'IT professional', 'Not yet identified', null, 'Not known', 10, 'English', 'Exploring side business', '2026-09-23'],
  ['APP-023', 'Maria Fernandes', 'Mysuru', '570017', 55, 5, 'Boutique owner', 'Rented', 480, 'Ground', 4, 'English', '', '2026-09-24'],
  ['APP-024', 'Joseph D\'Souza', 'Bengaluru', '560066', 70, 8, 'Footwear showroom', 'Owned', 900, 'Ground', 3, 'English', 'Whitefield main road, near the big mall', '2026-09-28'],
  ['APP-025', 'Rohit Verma', 'Bengaluru', '560097', 18, 0, 'Fresh graduate, family funded', 'Not yet identified', null, 'Not known', 6, 'Hindi', 'papa will invest, need guidance', '2026-09-29'],
  ['APP-026', 'Mahesh Angadi', 'Hubballi-Dharwad', '580001', 45, 5, 'Stationery wholesale', 'Rented', 420, 'Upper', 6, 'Kannada', '', '2026-10-01'],
  ['APP-027', 'Deepa Shenoy', 'Bengaluru', '560068', 75, 4, 'Optician, 4 yrs at a chain', 'Rented', 520, 'Ground', 3, 'Kannada', '', '2026-10-02'],
  ['APP-028', 'Nikhil Pai', 'Mangaluru', '575004', 40, 3, 'Cafe owner', 'Rented', 500, 'Mall unit', 5, 'English', 'Mall wants 9 yr lock-in', '2026-10-05'],
  ['APP-029', 'Ravikumar Gowda', 'Mysuru', '570023', 35, 2, 'textile', 'Rented', 350, 'Upper', 7, 'Kannada', 'applied before also?', '2026-10-06'],
  ['APP-030', 'Pooja Desai', 'Bengaluru', '560094', 180, 0, '', 'Owned', null, 'Ground', 4, 'English', 'Investor, will hire a manager', '2026-10-07'],
  ['APP-031', 'Ayesha Khan', 'Bengaluru', '560067', 25, 0, 'Homemaker, first business', 'Not yet identified', null, 'Not known', 1, 'Hindi', 'want to open fast', '2026-10-09'],
  ['APP-032', 'Manoj Tiwari', 'Belagavi', '590019', 50, 4, 'Auto parts dealer', 'Rented', 500, 'Ground', 6, 'Hindi', '', '2026-10-12'],
  ['APP-033', 'Sanjay Iyer', 'Bengaluru', '560102', 65, 7, 'Pharmacy owner', 'Rented', 480, 'Ground', 4, 'English', 'HSR sector 1', '2026-10-13'],
  ['APP-034', 'Divya Acharya', 'Mysuru', '570001', 90, 5, 'Dental clinic owner', 'Rented', 480, 'Ground', 4, 'English', 'Landlord NOC pending', '2026-10-14'],
  ['APP-035', 'Kiran Choudhary', 'Bengaluru', '560043', 45, 5, 'Telecom franchise', 'Rented', 120, 'Upper', 4, 'Hindi', 'Upper floor, 120 sq ft', '2026-10-16'],
  ['APP-036', 'Sneha Kulkarni', 'Hubballi-Dharwad', '580021', 25, 1, '', 'Not yet identified', null, 'Not known', 8, 'Kannada', 'pls call', '2026-10-19'],
  ['APP-037', 'Vinay Kamath', 'Bengaluru', '560037', 55, 5, 'Electronics retail', 'Rented', 450, 'Ground', 4, 'Kannada', '', '2026-10-20'],
  ['APP-038', 'Suresh Gowda', 'Tumakuru', '572102', 40, 6, 'Agri inputs shop', 'Owned', 600, 'Ground', 5, 'Kannada', 'BH road frontage', '2026-10-21'],
  ['APP-039', 'Fatima Sheikh', 'Davanagere', '577002', 10, 0, 'Tuition centre', 'Not yet identified', null, 'Not known', 12, 'Hindi', '', '2026-10-22'],
  ['APP-040', 'Anjali Saxena', 'Davanagere', '577004', 22, 0, '', 'Rented', 250, 'Upper', 9, 'Hindi', 'diwali se pehle kholna hai', '2026-10-24'],
];

export const applications: Application[] = rows.map(
  ([id, name, city, pin, investmentLakh, experienceYears, business, space, spaceSqft, floor, launchMonths, language, notes, submittedAt]) => ({
    id, name, city, state: 'Karnataka', pin, investmentLakh, experienceYears, business, space, spaceSqft, floor,
    launchMonths, language, notes, submittedAt,
  }),
);
