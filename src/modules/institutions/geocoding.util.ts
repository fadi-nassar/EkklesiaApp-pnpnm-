

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; country: string } | null>{
    const url= `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1&accept-language=en`
    const response = await fetch(url,{ headers:{'User-Agent':'Ekklesia'}})
    const result = await response.json()

    if (result.length === 0) 
        return null

    return {lat: Number(result[0].lat), lng: Number(result[0].lon), country: result[0].address?.country ?? 'Unknown'}
}