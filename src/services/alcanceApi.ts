import React from "react"
import { apiNacional } from "./api"

// Interface para dados de alcance deduplicado
export interface AlcanceDedupData {
  veiculo: string
  praca: string
  impressoes: number
  alcance: number
  // Campo platform mantido para compatibilidade com código existente
  platform?: string
}

// Função para buscar dados de alcance deduplicado de uma aba específica
const fetchAlcanceDataFromSheet = async (sheetName: string, veiculo: string) => {
  try {
    const response = await apiNacional.get(
      `/google/sheets/1wNHPGsPX3wQuUCBs3an7iBzBY6Y7THYV7V1GijXZo44/data?range=${sheetName}`,
    )
    
    // Tratamento de erro de leitura: a API pode retornar estrutura aninhada
    let values: any[][] = []
    if (response.data?.data?.values) {
      values = response.data.data.values
    } else if (response.data?.values) {
      values = response.data.values
    } else if (Array.isArray(response.data)) {
      values = response.data
    }
    
    return { data: { values }, veiculo }
  } catch (error) {
    console.error(`Erro ao buscar dados de ${sheetName}:`, error)
    throw error
  }
}

// Nova função para buscar dados das 3 abas dedicadas
export const fetchAlcanceDedicatedData = async (): Promise<AlcanceDedupData[]> => {
  try {
    // Buscar dados das 3 abas em paralelo
    const [tiktokResult, metaResult, uberResult] = await Promise.all([
      fetchAlcanceDataFromSheet("Tiktok_alcance", "TikTok"),
      fetchAlcanceDataFromSheet("Meta_alcance", "Meta"),
      fetchAlcanceDataFromSheet("Uber_alcance", "Uber"),
    ])

    const allData: AlcanceDedupData[] = []

    // Função auxiliar para encontrar índice da coluna pelo nome (case-insensitive)
    const getColumnIndex = (headers: any[], columnNames: string[]): number => {
      for (const name of columnNames) {
        const index = headers.findIndex((h) => {
          if (!h) return false
          const headerStr = h.toString().trim().toLowerCase()
          const searchName = name.toLowerCase()
          return headerStr === searchName || headerStr.includes(searchName)
        })
        if (index >= 0) {
          return index
        }
      }
      return -1 // Coluna não encontrada
    }

    // Função auxiliar para processar dados de uma aba
    const processSheetData = (result: { data: { values: any[][] }, veiculo: string }) => {
      const { data, veiculo } = result
      
      if (!data?.values || !Array.isArray(data.values) || data.values.length <= 1) {
        console.warn(`⚠️ [DEBUG] Dados vazios ou inválidos para ${veiculo}`)
        return
      }

      // Separar headers da primeira linha
      const headers = data.values[0]
      const rows = data.values.slice(1) // Pular header
      
      // Encontrar índices das colunas dinamicamente
      const impressionsIndex = getColumnIndex(headers, ["Impressions", "Impressoes", "impressions", "impressoes"])
      const reachIndex = getColumnIndex(headers, ["Reach", "Alcance", "reach", "alcance"])
      const pracaIndex = getColumnIndex(headers, ["Praça", "Praca", "praça", "praca"])
      const veiculoIndex = getColumnIndex(headers, ["Veículo", "Veiculo", "veículo", "veiculo"])
      
      // Log de debug para verificar índices encontrados
      console.log(`📋 [DEBUG] Índices encontrados para ${veiculo}:`, {
        Impressions: impressionsIndex,
        Reach: reachIndex,
        Praça: pracaIndex,
        Veículo: veiculoIndex,
        Headers: headers,
      })

      // Validar que encontramos as colunas essenciais
      if (impressionsIndex === -1 || reachIndex === -1) {
        console.error(`❌ [DEBUG] Colunas essenciais não encontradas para ${veiculo}. Headers:`, headers)
        return
      }
      
      const parseInteger = (value: string | number) => {
        if (!value || value === "") return 0
        const stringValue = value.toString().trim()
        const cleanValue = stringValue.replace(/\./g, "")
        return Number.parseInt(cleanValue) || 0
      }

      rows.forEach((row: any[], rowIndex: number) => {
        // Extrair dados usando índices dinâmicos
        const impressions = impressionsIndex >= 0 ? parseInteger(row[impressionsIndex] || "0") : 0
        const reach = reachIndex >= 0 ? parseInteger(row[reachIndex] || "0") : 0
        const praca = pracaIndex >= 0 ? (row[pracaIndex] || "").toString().trim() : ""
        const veiculoFromSheet = veiculoIndex >= 0 ? (row[veiculoIndex] || veiculo).toString().trim() : veiculo

        // Validar que temos dados válidos
        if (impressions > 0 || reach > 0) {
          allData.push({
            veiculo: veiculoFromSheet || veiculo,
            praca: praca,
            impressoes: impressions,
            alcance: reach,
            platform: veiculo, // Mantido para compatibilidade
          })
        } else if (rowIndex < 3) {
          // Log apenas para as primeiras linhas para debug
          console.log(`⚠️ [DEBUG] Linha ${rowIndex} ignorada (sem impressões ou alcance):`, {
            impressions,
            reach,
            row: row.slice(0, 6), // Primeiras 6 colunas para debug
          })
        }
      })
    }

    // Processar dados de cada aba
    processSheetData(tiktokResult)
    processSheetData(metaResult)
    processSheetData(uberResult)

    console.log(`✅ [DEBUG] Total de linhas de alcance carregadas: ${allData.length}`)
    if (allData.length > 0) {
      console.log("🧐 [DEBUG] Amostra dos dados de alcance:", allData.slice(0, 3))
    }

    return allData
  } catch (error) {
    console.error("Erro ao buscar dados de alcance dedicado:", error)
    throw error
  }
}

// Função para buscar dados de alcance deduplicado de todas as 3 abas (mantida para compatibilidade)
// Agora usa a nova função fetchAlcanceDedicatedData
export const fetchAlcanceDedupData = async (): Promise<AlcanceDedupData[]> => {
  return fetchAlcanceDedicatedData()
}

// Hook para buscar dados de alcance deduplicado
export const useAlcanceDedupData = () => {
  const [data, setData] = React.useState<AlcanceDedupData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchAlcanceDedicatedData()
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
      // Filtro de Praça (coluna E)
      const matchPraca =
        selectedPracas.length === 0 || selectedPracas.some((p) => p.toLowerCase() === item.praca.toLowerCase())

      // Filtro de Veículo/Plataforma (coluna F)
      const veiculo = item.veiculo || item.platform || ""
      const matchPlatform =
        selectedPlatforms.length === 0 ||
        selectedPlatforms.some((p) => p.toLowerCase() === veiculo.toLowerCase())

      return matchPraca && matchPlatform
    })

    // Calcular totais
    const totalReach = filtered.reduce((sum, item) => sum + item.alcance, 0)
    const totalImpressions = filtered.reduce((sum, item) => sum + item.impressoes, 0)

    // Calcular frequência média: (Soma das Impressões filtradas) / (Total Alcance)
    // Se alcance for 0, frequência é 0
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




