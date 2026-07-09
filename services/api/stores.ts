import { apiClient } from './client';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassNode[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function fetchNearbySupermarkets(latitude: number, longitude: number, radiusKm: number = 5): Promise<any[]> {
  const query = `[timeout:10][out:json];(node["shop"~"supermarket|grocery"](around:${radiusKm * 1000},${latitude},${longitude}););out center;`;
  
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!response.ok) throw new Error('Overpass API error');
    const data: OverpassResponse = await response.json();
    
    return data.elements
      .map(node => ({
        id: `store_${node.id}`,
        name: node.tags.name || 'Magasin sans nom',
        brand: node.tags.brand || 'Indépendant',
        address: node.tags['addr:street'] ? `${node.tags['addr:house_number'] || ''} ${node.tags['addr:street']}`.trim() : 'Adresse non disponible',
        latitude: node.lat,
        longitude: node.lon,
        hours: node.tags['opening_hours'] || 'Horaires non disponibles',
      }))
      .sort((a, b) => haversineDistance(latitude, longitude, a.latitude, a.longitude) - haversineDistance(latitude, longitude, b.latitude, b.longitude));
  } catch (error) {
    console.error('Erreur Overpass API:', error);
    return [];
  }
}