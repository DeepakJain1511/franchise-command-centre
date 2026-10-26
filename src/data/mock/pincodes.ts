import type { City } from '@/engine/types';

/**
 * PIN locality centroids — APPROXIMATE, FOR DEMO ONLY.
 * Locality names were checked against public PIN directories (India Post aggregators,
 * which do not always agree); coordinates are the approximate centre of that locality,
 * not a surveyed PIN boundary. The map draws each PIN as a hex at (or within ~1 km of)
 * this point.
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
  p('560001', 'Bengaluru', 'MG Road', 12.9756, 77.6066),
  p('560034', 'Bengaluru', 'Koramangala', 12.9352, 77.6245),
  p('560038', 'Bengaluru', 'Indiranagar', 12.9719, 77.6412),
  // TER-01 East
  p('560037', 'Bengaluru', 'Marathahalli', 12.9569, 77.7011),
  p('560048', 'Bengaluru', 'Mahadevapura', 12.9911, 77.6950),
  p('560036', 'Bengaluru', 'KR Puram', 13.0050, 77.6800),
  p('560067', 'Bengaluru', 'Kadugodi', 12.9960, 77.7600),
  p('560087', 'Bengaluru', 'Varthur', 12.9400, 77.7470),
  p('560066', 'Bengaluru', 'Whitefield', 12.9698, 77.7500),
  p('560103', 'Bengaluru', 'Bellandur', 12.9260, 77.6760),
  // TER-02 South
  p('560102', 'Bengaluru', 'HSR Layout', 12.9116, 77.6474),
  p('560068', 'Bengaluru', 'Bommanahalli', 12.9000, 77.6200),
  p('560100', 'Bengaluru', 'Electronic City', 12.8452, 77.6602),
  p('560078', 'Bengaluru', 'JP Nagar', 12.9063, 77.5857),
  p('560041', 'Bengaluru', 'Jayanagar', 12.9250, 77.5938),
  p('560076', 'Bengaluru', 'Bilekahalli / BTM', 12.8930, 77.6050),
  p('560062', 'Bengaluru', 'Konanakunte', 12.8800, 77.5600),
  // TER-03 North
  p('560024', 'Bengaluru', 'Hebbal', 13.0358, 77.5970),
  p('560092', 'Bengaluru', 'Sahakara Nagar', 13.0620, 77.5860),
  p('560064', 'Bengaluru', 'Yelahanka', 13.1007, 77.5963),
  p('560097', 'Bengaluru', 'Vidyaranyapura', 13.0790, 77.5580),
  p('560094', 'Bengaluru', 'RMV 2nd Stage', 13.0350, 77.5700),
  p('560043', 'Bengaluru', 'HRBR Layout', 13.0220, 77.6400),
  // Mysuru
  p('570001', 'Mysuru', 'KR Circle', 12.3075, 76.6535),
  p('570002', 'Mysuru', 'Gokulam', 12.3285, 76.6310),
  p('570008', 'Mysuru', 'Srirampura', 12.2790, 76.6370),
  p('570009', 'Mysuru', 'Saraswathipuram', 12.2985, 76.6255),
  p('570011', 'Mysuru', 'Siddarthanagar', 12.2960, 76.6720),
  p('570017', 'Mysuru', 'Vijayanagar 2nd Stage', 12.3420, 76.6110),
  p('570020', 'Mysuru', 'Yadavagiri', 12.3200, 76.6355),
  p('570023', 'Mysuru', 'Kuvempunagar', 12.2860, 76.6215),
  // Mangaluru
  p('575001', 'Mangaluru', 'Hampankatta', 12.8680, 74.8420),
  p('575002', 'Mangaluru', 'Balmatta', 12.8735, 74.8530),
  p('575003', 'Mangaluru', 'Bolar', 12.8530, 74.8440),
  p('575004', 'Mangaluru', 'Bejai', 12.8870, 74.8490),
  p('575006', 'Mangaluru', 'Ashok Nagar', 12.8950, 74.8350),
  // Hubballi-Dharwad
  p('580020', 'Hubballi-Dharwad', 'Hubballi Central', 15.3480, 75.1390),
  p('580021', 'Hubballi-Dharwad', 'Vidyanagar', 15.3690, 75.1230),
  p('580029', 'Hubballi-Dharwad', 'Bharat Mill', 15.3560, 75.1500),
  p('580030', 'Hubballi-Dharwad', 'Akshay Colony', 15.3330, 75.1080),
  p('580031', 'Hubballi-Dharwad', 'Unkal', 15.3800, 75.1150),
  p('580001', 'Hubballi-Dharwad', 'Dharwad', 15.4589, 75.0078),
  p('580004', 'Hubballi-Dharwad', 'Dharwad North', 15.4720, 75.0150),
  // Belagavi
  p('590001', 'Belagavi', 'Camp', 15.8480, 74.5150),
  p('590006', 'Belagavi', 'Tilakwadi', 15.8320, 74.5100),
  p('590010', 'Belagavi', 'Nehru Nagar', 15.8640, 74.5300),
  p('590011', 'Belagavi', 'Hindwadi', 15.8370, 74.4980),
  p('590016', 'Belagavi', 'Fort / Bus Stand', 15.8620, 74.5110),
  p('590019', 'Belagavi', 'Doordarshan Nagar', 15.8790, 74.5230),
  // Tumakuru
  p('572101', 'Tumakuru', 'Tumakuru City', 13.3400, 77.1010),
  p('572102', 'Tumakuru', 'SG Extension', 13.3320, 77.1090),
  p('572103', 'Tumakuru', 'University / Kuvempunagar', 13.3270, 77.1200),
  p('572104', 'Tumakuru', 'Belagumba', 13.3600, 77.0800),
  p('572106', 'Tumakuru', 'Northern Extension', 13.3560, 77.1130),
  // Davanagere (no territory)
  p('577002', 'Davanagere', 'Davanagere Central', 14.4644, 75.9218),
  p('577004', 'Davanagere', 'Davanagere South', 14.4480, 75.9050),
];

/** True city centres (used for state-level city markers). */
export const cityCentres: Record<City, { lat: number; lng: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Mysuru: { lat: 12.2958, lng: 76.6394 },
  Mangaluru: { lat: 12.9141, lng: 74.856 },
  'Hubballi-Dharwad': { lat: 15.3647, lng: 75.124 },
  Belagavi: { lat: 15.8497, lng: 74.4977 },
  Tumakuru: { lat: 13.3379, lng: 77.1173 },
  Davanagere: { lat: 14.4644, lng: 75.9218 },
};
