const ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=en'

export async function translateToEnglish(text) {
  const key = process.env.AZURE_TRANSLATOR_KEY
  const region = process.env.AZURE_TRANSLATOR_REGION
  if (!key || !region || !text) return null

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
    })
    if (!res.ok) return null
    const data = await res.json()
    const detected = data?.[0]?.detectedLanguage?.language
    const translation = data?.[0]?.translations?.[0]?.text
    if (!translation || detected === 'en') return null
    return translation
  } catch {
    return null
  }
}
