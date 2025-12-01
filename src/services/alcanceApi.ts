import React from "react"
import { apiNacional } from "./api"

// Interface unificada para dados de alcance
export interface AlcanceDedupData {
  veiculo: string
  praca: string
  impressoes: number
  alcance: number
  // Campo platform mantido para compatibilidade
  platform?: string
}

// --- FUNÇÃO DE BUSCA OTIMIZADA E CORRIGIDA ---
export const fetchAlcanceDedupData = async (): Promise<AlcanceDedupData[]> => {
  console.log("🚀 [DEBUG] Iniciando busca de Alcance (TikTok, Meta, Uber)...")
  
  // ID CORRETO DO DASHBOARD CCBB FLIGHT 2
  const SPREADSHEET_ID = "1tdFuCDyh1RDvhv9EGoZVJTBiHLSSOk-uUjp5rSbMUgg"
  
  const sources = [
    { id: 'tiktok', range: 'Tiktok_alcance', platform: 'TikTok' },
    { id: 'meta', range: 'Meta_alcance', platform: 'Meta' },
    { id: 'uber', range: 'Uber_alcance', platform: 'Uber' }
  ]

  let allData: AlcanceDedupData[] = []

  try {
    // Busca todas as abas em paralelo
    const results = await Promise.all(
      sources.map(src => 
        apiNacional.get(`/google/sheets/${SPREADSHEET_ID}/data?range=${src.range}`)
      )
    )

    results.forEach((res, index) => {
      const sourceInfo = sources[index]
      const payload = res.data
      const rows = payload?.data?.values || payload?.values || []
      
      console.log(`📦 [DEBUG] Aba ${sourceInfo.range}: Encontradas ${rows.length} linhas`)

      if (rows.length > 1) {
        // Encontrar índices dinamicamente pelo nome
        const headers = rows[0].map((h: string) => h.toString().toLowerCase().trim())
        
        const idxImp = headers.findIndex((h: string) => h.includes("impressions") || h.includes("impressoes"))
        const idxReach = headers.findIndex((h: string) => h.includes("reach") || h.includes("alcance"))
        const idxPraca = headers.findIndex((h: string) => h.includes("praça") || h.includes("praca"))
        const idxVeiculo = headers.findIndex((h: string) => h.includes("veículo") || h.includes("veiculo"))

        // Função auxiliar para pegar valor seguro ou usar backup fixo
        const getVal = (row: any[], idxName: number, idxFixed: number) => {
            const i = idxName !== -1 ? idxName : idxFixed
            return row[i]
        }

        const cleanRows = rows.slice(1).map((row: any[]) => {
          const parseNum = (v: any) => {
            if (!v) return 0
            const str = v.toString().replace(/\./g, '').replace(',', '.')
            return Number(str) || 0
          }

          // Prioriza a coluna "Veículo" da planilha, se não tiver, usa o fixo
          const veiculoPlanilha = getVal(row, idxVeiculo, 5)
          const veiculoFinal = veiculoPlanilha ? veiculoPlanilha.toString().trim() : sourceInfo.platform

          const imp = parseNum(getVal(row, idxImp, 1))
          const alc = parseNum(getVal(row, idxReach, 2))

          // Só adiciona se tiver dados
          if (imp > 0 || alc > 0) {
            return {
              veiculo: veiculoFinal,
              praca: getVal(row, idxPraca, 4)?.toString().trim() || "Nacional",
              impressoes: imp,
              alcance: alc,
              platform: veiculoFinal // Compatibilidade
            }
          }
          return null
        }).filter(Boolean) as AlcanceDedupData[]
        
        allData = [...allData, ...cleanRows]
      }
    })

    console.log(`✅ [DEBUG] Total de linhas de alcance carregadas: ${allData.length}`)
    return allData

  } catch (error) {
    console.error("❌ [DEBUG] Erro ao buscar dados de alcance:", error)
    return []
  }
}

// Mantendo exportação para compatibilidade caso algo importe com esse nome antigo
export const fetchAlcanceDedicatedData = fetchAlcanceDedupData;

// --- HOOKS DO REACT (MANTIDOS E ATUALIZADOS) ---

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

      // Filtro de Veículo/Plataforma
      const veiculo = item.veiculo || item.platform || ""
      const matchPlatform =
        selectedPlatforms.length === 0 ||
        selectedPlatforms.some((p) => p.toLowerCase() === veiculo.toLowerCase())

      return matchPraca && matchPlatform
    })

    // Calcular totais
    const totalReach = filtered.reduce((sum, item) => sum + item.alcance, 0)
    const totalImpressions = filtered.reduce((sum, item) => sum + item.impressoes, 0)

    // Calcular frequência média ponderada
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0

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
```Compiling...