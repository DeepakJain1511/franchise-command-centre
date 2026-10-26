import type { City } from '@/engine/types';

/**
 * APPROXIMATE PIN centroids — FOR DEMO ONLY.
 * These are plausible points inside the right neighbourhood of each city, not surveyed
 * boundaries. The map snaps them onto a hex lattice (see lib/hex.ts) so each PIN renders
 * as a clean, non-overlapping tile.
 */
export interface PinCentroid {
  pin: string;
  city: City;
  area: string;
  lat: number;
  lng: number;
}

const p = (pin: string, city: City, area: string, lat: number, lng: number): PinCentroid => ({ pin, city, area, lat, lng });

export const pincodes: PinCentroid[] = [
  // Bengaluru — central (existing stores, outside any territory)
  p('560001', 'Bengaluru', 'MG Road', 12.9763, 77.6033),
  p('560034', 'Bengaluru', 'Koramangala', 12.9352, 77.6245),
  p('560038', 'Bengaluru', 'Indiranagar', 12.9719, 77.6412),
  // TER-01 East
  p('560037', 'Bengaluru', 'Marathahalli', 12.9569, 77.7011),
  p('560048', 'Bengaluru', 'Mahadevapura', 12.9911, 77.695),
  p('560036', 'Bengaluru', 'KR Puram', 13.012, 77.68),
  p('560067', 'Bengaluru', 'Kadugodi', 12.996, 77.76),
  p('560087', 'Bengaluru', 'Varthur', 12.94, 77.747),
  p('560066', 'Bengaluru', 'Whitefield', 12.9698, 77.75),
  p('560103', 'Bengaluru', 'Bellandur', 12.926, 77.676),
  // TER-02 South
  p('560102', 'Bengaluru', 'HSR Layout', 12.9116, 77.6474),
  p('560068', 'Bengaluru', 'Bommanahalli', 12.9, 77.62),
  p('560100', 'Bengaluru', 'Electronic City', 12.8452, 77.6602),
  p('560078', 'Bengaluru', 'JP Nagar', 12.9063, 77.5857),
  p('560041', 'Bengaluru', 'Jayanagar', 12.925, 77.5938),
  p('560076', 'Bengaluru', 'Bannerghatta Rd', 12.89, 77.599),
  p('560062', 'Bengaluru', 'Konanakunte', 12.88, 77.56),
  // TER-03 North
  p('560024', 'Bengaluru', 'Hebbal', 13.0358, 77.597),
  p('560092', 'Bengaluru', 'Sahakara Nagar', 13.062, 77.586),
  p('560064', 'Bengaluru', 'Yelahanka', 13.1007, 77.5963),
  p('560097', 'Bengaluru', 'Vidyaranyapura', 13.079, 77.558),
  p('560094', 'Bengaluru', 'RMV 2nd Stage', 13.035, 77.57),
  p('560043', 'Bengaluru', 'HRBR Layout', 13.022, 77.64),
  // Mysuru
  p('570001', 'Mysuru', 'Mysuru City', 12.308, 76.652),
  p('570002', 'Mysuru', 'Devaraja Mohalla', 12.31, 76.645),
  p('570008', 'Mysuru', 'Agrahara', 12.299, 76.648),
  p('570011', 'Mysuru', 'Vijayanagar', 12.33, 76.62),
  p('570017', 'Mysuru', 'Hebbal (Mysuru)', 12.35, 76.615),
  p('570020', 'Mysuru', 'Hootagalli', 12.318, 76.665),
  p('570023', 'Mysuru', 'JP Nagar (Mysuru)', 12.27, 76.62),
  p('570009', 'Mysuru', 'Kuvempunagar', 12.29, 76.625),
  // Mangaluru
  p('575001', 'Mangaluru', 'Hampankatta', 12.87, 74.843),
  p('575002', 'Mangaluru', 'Bunder', 12.865, 74.835),
  p('575003', 'Mangaluru', 'Kodialbail', 12.88, 74.85),
  p('575004', 'Mangaluru', 'Kankanady', 12.86, 74.86),
  p('575006', 'Mangaluru', 'Kadri', 12.885, 74.865),
  // Hubballi-Dharwad
  p('580020', 'Hubballi-Dharwad', 'Hubballi Central', 15.35, 75.14),
  p('580021', 'Hubballi-Dharwad', 'Old Hubballi', 15.36, 75.125),
  p('580029', 'Hubballi-Dharwad', 'Vidyanagar', 15.37, 75.11),
  p('580030', 'Hubballi-Dharwad', 'Gokul Road', 15.33, 75.13),
  p('580031', 'Hubballi-Dharwad', 'Keshwapur', 15.34, 75.16),
  p('580001', 'Hubballi-Dharwad', 'Dharwad', 15.4589, 75.0078),
  p('580004', 'Hubballi-Dharwad', 'Saptapur', 15.44, 75.03),
  // Belagavi
  p('590001', 'Belagavi', 'Belagavi Fort', 15.8497, 74.4977),
  p('590006', 'Belagavi', 'Tilakwadi', 15.865, 74.51),
  p('590010', 'Belagavi', 'Shahapur', 15.83, 74.52),
  p('590011', 'Belagavi', 'Camp', 15.87, 74.48),
  p('590016', 'Belagavi', 'Angol', 15.82, 74.49),
  p('590019', 'Belagavi', 'Hindalga', 15.89, 74.53),
  // Tumakuru
  p('572101', 'Tumakuru', 'Tumakuru City', 13.34, 77.101),
  p('572102', 'Tumakuru', 'SIT Extension', 13.33, 77.12),
  p('572103', 'Tumakuru', 'Batawadi', 13.35, 77.09),
  p('572104', 'Tumakuru', 'Kyatsandra', 13.32, 77.095),
  p('572106', 'Tumakuru', 'Sira Gate', 13.36, 77.115),
  // Davanagere (no territory)
  p('577002', 'Davanagere', 'PJ Extension', 14.46, 75.92),
  p('577004', 'Davanagere', 'Vidyanagar (DVG)', 14.47, 75.9),
];

export const cityCentres: Record<City, { lat: number; lng: number; zoom: number; tier: 'Tier 1' | 'Tier 2' | 'Tier 3' }> = {
  Bengaluru: { lat: 12.97, lng: 77.64, zoom: 11, tier: 'Tier 1' },
  Mysuru: { lat: 12.31, lng: 76.64, zoom: 12, tier: 'Tier 2' },
  Mangaluru: { lat: 12.873, lng: 74.85, zoom: 13, tier: 'Tier 2' },
  'Hubballi-Dharwad': { lat: 15.4, lng: 75.08, zoom: 11, tier: 'Tier 2' },
  Belagavi: { lat: 15.855, lng: 74.505, zoom: 13, tier: 'Tier 2' },
  Tumakuru: { lat: 13.34, lng: 77.105, zoom: 13, tier: 'Tier 3' },
  Davanagere: { lat: 14.465, lng: 75.91, zoom: 13, tier: 'Tier 3' },
};

export const KARNATAKA_BOUNDS: [[number, number], [number, number]] = [
  [11.8, 74.0],
  [16.4, 78.2],
];
