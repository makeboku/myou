const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

interface NominatimResult {
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  display_name: string;
}

export async function searchCity(city: string, country: string): Promise<NominatimResult | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?q=${encodeURIComponent(city + "," + country)}&format=json&limit=1&accept-language=en`,
      { headers: { "User-Agent": "Zmail/1.0" } }
    );
    if (!res.ok) return null;
    const data: NominatimResult[] = await res.json();
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<NominatimResult | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "Zmail/1.0" } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface RandomUserResult {
  results: Array<{
    name: { first: string; last: string };
    phone: string;
    id: { name: string; value: string | null };
    login: { username: string; password: string };
    dob: { date: string };
    gender: string;
  }>;
}

const RANDOMUSER_NAT: Record<string, string> = {
  US: "US", GB: "GB", CA: "CA", AU: "AU",
  DE: "DE", FR: "FR", BR: "BR", CH: "CH",
  DK: "DK", ES: "ES", FI: "FI", IE: "IE",
  IN: "IN", IR: "IR", MX: "MX", NL: "NL",
  NO: "NO", NZ: "NZ", RS: "RS", TR: "TR",
  UA: "UA",
};

export async function fetchRandomUser(nat?: string): Promise<RandomUserResult["results"][0] | null> {
  const natParam = nat && RANDOMUSER_NAT[nat] ? `&nat=${RANDOMUSER_NAT[nat]}` : "";
  try {
    const res = await fetch(
      `https://randomuser.me/api/?inc=name,phone,id,login,dob,gender${natParam}`,
      { headers: { "User-Agent": "Zmail/1.0" } }
    );
    if (!res.ok) return null;
    const data: RandomUserResult = await res.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

export async function getRealAddress(city: string, country: string): Promise<{
  streetAddress: string;
  city: string;
  state: string;
  stateFull: string;
  zipCode: string;
  fullAddress: string;
} | null> {
  const cityResult = await searchCity(city, country);
  if (!cityResult) return null;

  const bb = cityResult.boundingbox;
  const minLat = parseFloat(bb[0]);
  const maxLat = parseFloat(bb[1]);
  const minLon = parseFloat(bb[2]);
  const maxLon = parseFloat(bb[3]);

  const lat = minLat + Math.random() * (maxLat - minLat);
  const lon = minLon + Math.random() * (maxLon - minLon);

  const addrResult = await reverseGeocode(lat, lon);
  if (!addrResult?.address) return null;

  const a = addrResult.address;
  const road = a.road || "";
  const houseNum = a.house_number || String(Math.floor(1 + Math.random() * 9999));
  const streetAddress = `${houseNum} ${road}`.trim();
  const cityName = a.city || a.town || a.village || city;
  const stateFull = a.state || "";
  const zipCode = a.postcode || "";
  
  return {
    streetAddress,
    city: cityName,
    state: "",
    stateFull,
    zipCode,
    fullAddress: `${streetAddress}\n${cityName}, ${stateFull} ${zipCode}\n${country}`,
  };
}
