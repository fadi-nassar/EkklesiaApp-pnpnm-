

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>{
    const url= `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    const response = await fetch(url,{ headers:{'User-Agent':'Ekklesia'}})
    const result = await response.json()

    if (result.length === 0) 
        return null

    return {lat: Number(result[0].lat), lng: Number(result[0].lon)}
}