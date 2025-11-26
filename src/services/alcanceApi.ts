import React from "react"
import { apiNacional } from "./api"

// Interface para dados de alcance deduplicado
export interface AlcanceDedupData {
  platform: string
  advertiserName: string
  impressions: number
  reach: number
  frequency: number
  praca: string
}

// Função para buscar dados de alcance deduplicado de uma aba específica
const fetchAlcanceDataFromSheet = async (sheetName: string, platform: string) => {
  try {
    const response = await apiNacional.get(
      `/google/sheets/1tdFuCDyh1RDvhv9EGoZVJTBiHLSSOk-uUjp5rSbMUgg/data?range=${sheetName}!A:E`,
    )
    return { data: response.data, platform }
  } catch (error) {
    console.error(`Erro ao buscar dados de ${sheetName}:`, error)
    throw error
  }
}

// Função para buscar dados de alcance deduplicado de todas as 3 abas
export const fetchAlcanceDedupData = async (): Promise<AlcanceDedupData[]> => {
  try {
    // Buscar dados das 3 abas em paralelo
    const [tiktokResult, metaResult, uberResult] = await Promise.all([
      fetchAlcanceDataFromSheet("Tiktok_alcance", "TikTok"),
      fetchAlcanceDataFromSheet("Meta_alcance", "Meta"),
      fetchAlcanceDataFromSheet("Uber_alcance", "Uber"),
    ])

    const allData: AlcanceDedupData[] = []

    // Processar dados do TikTok
    if (tiktokResult.data?.values) {
      const rows = tiktokResult.data.values.slice(1) // Pular header
      rows.forEach((row: any[]) => {
        const parseNumber = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "").replace(",", ".")
          return Number.parseFloat(cleanValue) || 0
        }

        const parseInteger = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "")
          return Number.parseInt(cleanValue) || 0
        }

        const advertiserName = (row[0] || "").toString().trim()
        const impressions = parseInteger(row[1] || "0")
        const reach = parseInteger(row[2] || "0")
        const frequency = parseNumber(row[3] || "0")
        const praca = (row[4] || "").toString().trim()

        if (advertiserName || impressions > 0 || reach > 0) {
          allData.push({
            platform: "TikTok",
            advertiserName,
            impressions,
            reach,
            frequency,
            praca,
          })
        }
      })
    }

    // Processar dados do Meta
    if (metaResult.data?.values) {
      const rows = metaResult.data.values.slice(1) // Pular header
      rows.forEach((row: any[]) => {
        const parseNumber = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "").replace(",", ".")
          return Number.parseFloat(cleanValue) || 0
        }

        const parseInteger = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "")
          return Number.parseInt(cleanValue) || 0
        }

        const advertiserName = (row[0] || "").toString().trim()
        const impressions = parseInteger(row[1] || "0")
        const reach = parseInteger(row[2] || "0")
        const frequency = parseNumber(row[3] || "0")
        const praca = (row[4] || "").toString().trim()

        if (advertiserName || impressions > 0 || reach > 0) {
          allData.push({
            platform: "Meta",
            advertiserName,
            impressions,
            reach,
            frequency,
            praca,
          })
        }
      })
    }

    // Processar dados do Uber
    if (uberResult.data?.values) {
      const rows = uberResult.data.values.slice(1) // Pular header
      rows.forEach((row: any[]) => {
        const parseNumber = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "").replace(",", ".")
          return Number.parseFloat(cleanValue) || 0
        }

        const parseInteger = (value: string | number) => {
          if (!value || value === "") return 0
          const stringValue = value.toString().trim()
          const cleanValue = stringValue.replace(/\./g, "")
          return Number.parseInt(cleanValue) || 0
        }

        const advertiserName = (row[0] || "").toString().trim()
        const impressions = parseInteger(row[1] || "0")
        const reach = parseInteger(row[2] || "0")
        const frequency = parseNumber(row[3] || "0")
        const praca = (row[4] || "").toString().trim()

        if (advertiserName || impressions > 0 || reach > 0) {
          allData.push({
            platform: "Uber",
            advertiserName,
            impressions,
            reach,
            frequency,
            praca,
          })
        }
      })
    }

    console.log(`✅ [DEBUG] Total de linhas de alcance carregadas: ${allData.length}`)
    if (allData.length > 0) {
      console.log("🧐 [DEBUG] Amostra dos dados de alcance:", allData.slice(0, 3))
    }

    return allData
  } catch (error) {
    console.error("Erro ao buscar dados de alcance deduplicado:", error)
    throw error
  }
}

// Hook para buscar dados de alcance deduplicado
export const useAlcanceDedupData = () => {
  const [data, setData] = React.useState<AlcanceDedupData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchAlcanceDedupData()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

// Hook customizado para calcular métricas de alcance baseado nos filtros
export const useAlcanceMetrics = (selectedPracas: string[] = [], selectedPlatforms: string[] = []) => {
  const { data: alcanceData, loading, error } = useAlcanceDedupData()

  const metrics = React.useMemo(() => {
    if (alcanceData.length === 0) {
      return {
        totalReach: 0,
        totalImpressions: 0,
        avgFrequency: 0,
        loading: false,
        error: null,
      }
    }

    // Filtrar dados
    const filtered = alcanceData.filter((item) => {
      // Filtro de Praça
      const matchPraca =
        selectedPracas.length === 0 || selectedPracas.some((p) => p.toLowerCase() === item.praca.toLowerCase())

      // Filtro de Plataforma
      const matchPlatform =
        selectedPlatforms.length === 0 ||
        selectedPlatforms.some((p) => p.toLowerCase() === item.platform.toLowerCase())

      return matchPraca && matchPlatform
    })

    // Calcular totais
    const totalReach = filtered.reduce((sum, item) => sum + item.reach, 0)
    const totalImpressions = filtered.reduce((sum, item) => sum + item.impressions, 0)

    // Calcular frequência média (totalImpressions / totalReach)
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0

    console.log(`🔍 [DEBUG] Métricas de Alcance calculadas:`, {
      selectedPracas,
      selectedPlatforms,
      linhasFiltradas: filtered.length,
      totalReach,
      totalImpressions,
      avgFrequency,
    })

    return {
      totalReach,
      totalImpressions,
      avgFrequency,
      loading: false,
      error: null,
    }
  }, [alcanceData, selectedPracas, selectedPlatforms])

  return {
    ...metrics,
    loading,
    error,
  }
}

