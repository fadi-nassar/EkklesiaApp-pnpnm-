const GEOCODE_TIMEOUT_MS = 5000;

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; country: string } | null>{
    const url= `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1&accept-language=en`
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(url, {
            headers: { 'User-Agent': 'Ekklesia' },
            signal: controller.signal,
        });
    } catch {
        // timed out or otherwise unreachable: let the caller fall back to its
        // town lookup, the same as when nominatim returns zero results
        return null;
    } finally {
        clearTimeout(timeout);
    }

    const result = await response.json()

    if (result.length === 0)
        return null

    return {lat: Number(result[0].lat), lng: Number(result[0].lon), country: result[0].address?.country ?? 'Unknown'}
}
