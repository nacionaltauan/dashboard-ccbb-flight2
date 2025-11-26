import React from "react"
import { apiNacional } from "./api"

// Interface para dados de benchmark existentes (mantendo compatibilidade)
export interface BenchmarkData {
  veiculo: string
  tipoMidia: string
  cpm: number
  cpc: number
  ctr: number
  vtr: number
  completionRate: number
}

// NOVA INTERFACE para o Flight 1 (Comparativo)
export interface Flight1Data {
  veiculo: string
  praca: string
  custo: number
  impressoes: number
  cliques: number
}

// Função para buscar dados de benchmark (existente)
export const fetchBenchmarkNacionalData = async () => {
  try {
    const response = await apiNacional.get(
      "/google/sheets/1tdFuCDyh1RDvhv9EGoZVJTBiHLSSOk-uUjp5rSbMUgg/data?range=BENCHMARK",
    )
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de benchmark:", error)
    throw error
  }
}

// NOVA FUNÇÃO: Busca dados da aba Bench_ccbbf1
export const fetchFlight1Data = async () => {
  try {
    const response = await apiNacional.get(
      "/google/sheets/1tdFuCDyh1RDvhv9EGoZVJTBiHLSSOk-uUjp5rSbMUgg/data?range=Bench_ccbbf1!A:E",
    )
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Flight 1:", error)
    throw error
  }
}

// Hook para dados de benchmark (existente)
export const useBenchmarkNacionalData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchBenchmarkNacionalData()
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

// Função para processar dados de benchmark (existente)
export const processBenchmarkData = (apiData: any): Map<string, BenchmarkData> => {
  const benchmarkMap = new Map<string, BenchmarkData>()
  
  if (apiData?.values) {
    const headers = apiData.values[0]
    const rows = apiData.values.slice(1)
    
    rows.forEach((row: any[]) => {
      const veiculo = row[0]?.toUpperCase() || ""
      const tipoMidia = row[1]?.toUpperCase() || ""
      
      if (veiculo && tipoMidia) {
        const parseNumber = (value: string) => {
          if (!value || value === "") return 0
          return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
        }
        
        const key = `${veiculo}_${tipoMidia}`
        benchmarkMap.set(key, {
          veiculo,
          tipoMidia,
          cpm: parseNumber(row[2]),
          cpc: parseNumber(row[3]),
          ctr: parseNumber(row[7]),
          vtr: parseNumber(row[8]),
          completionRate: parseNumber(row[8]),
        })
      }
    })
  }
  
  return benchmarkMap
}

// Função para calcular variação (existente - mantida por compatibilidade com outros componentes)
export const calculateVariation = (
  currentValue: number,
  benchmarkValue: number,
  metricType: 'cost' | 'performance'
): { value: string; color: string } => {
  if (benchmarkValue === 0) {
    return { value: "-", color: "text-gray-500" }
  }
  
  const difference = currentValue - benchmarkValue
  let isBetter: boolean
  
  if (metricType === 'cost') {
    isBetter = difference < 0
  } else {
    isBetter = difference > 0
  }
  
  const sign = difference > 0 ? "+" : ""
  const formattedValue = difference.toFixed(2)
  
  return {
    value: `${sign}${formattedValue}`,
    color: isBetter ? "text-green-600" : "text-red-600"
  }
}