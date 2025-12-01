"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { BarChart3, Calendar, Filter, MapPin } from "lucide-react"
import { useConsolidadoNacionalData } from "../../services/api"
import { useFlight1Data, type Flight1Data } from "../../services/benchmarkApi"
import { useAlcanceMetrics, useAlcanceDedupData } from "../../services/alcanceApi"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import Loading from "../../components/Loading/Loading"

// Interface for the raw API data
interface ApiDataItem {
  date?: string
  platform?: string
  campaignName?: string
  impressions?: number
  cost?: number
  reach?: number
  clicks?: number
  frequency?: number
  cpm?: number
  praca?: string
}

interface ProcessedData {
  date: string
  platform: string
  campaignName: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  frequency: number
  cpm: number
  praca: string
}

interface PlatformMetrics {
  platform: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  cpm: number
  frequency: number
  color: string
}

interface ChartDataPoint {
  platform: string
  value: number
  color: string
}

// Interface para métricas de benchmark por veículo
interface VehicleBenchmarkMetrics {
  veiculo: string
  custo: number
  impressoes: number
  cliques: number
  cpc: number
  ctr: number
  cpm: number
}

const VisaoGeral: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: apiData, loading, error } = useConsolidadoNacionalData()
  const { data: flight1Data, loading: flight1Loading } = useFlight1Data()
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedPracas, setSelectedPracas] = useState<string[]>([])

  // Buscar métricas de alcance deduplicado
  const alcanceMetrics = useAlcanceMetrics(selectedPracas, selectedPlatforms)
  const { data: alcanceDedupData } = useAlcanceDedupData()

  // Cores para as plataformas
  const platformColors: Record<string, string> = {
    Google: "#4285f4",
    Meta: "#0668E1",
    TikTok: "#ff0050",
    YouTube: "#ff0000",
    Kwai: "#ff6b35",
    "Globo.com": "#00a86b",
    Serasa: "#9b59b6",
    "Folha de SP": "#e91e63",
    Spotify: "#1DB954",
    Default: "#6366f1",
  }

  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>()
    processedData.forEach((item) => {
      platforms.add(item.platform)
    })
    return Array.from(platforms)
  }, [processedData])

  const availablePracas = useMemo(() => {
    const pracas = new Set<string>()
    processedData.forEach((item) => {
      pracas.add(item.praca)
    })
    return Array.from(pracas)
  }, [processedData])

  // Processar dados do Flight 1 para benchmark por veículo
  const vehicleBenchmarks = useMemo(() => {
    if (!flight1Data || flight1Data.length === 0) {
      return []
    }

    // Filtrar por praça (respeitar filtro de praça)
    let filtered = flight1Data
    if (selectedPracas.length > 0) {
      filtered = flight1Data.filter((item) =>
        selectedPracas.some((p) => p.toLowerCase() === item.praca.toLowerCase())
      )
    }

    // Agrupar por veículo e somar valores
    const groupedByVehicle = filtered.reduce((acc, item) => {
      const veiculo = item.veiculo.trim()
      if (!veiculo) return acc

      if (!acc[veiculo]) {
        acc[veiculo] = {
          veiculo,
          custo: 0,
          impressoes: 0,
          cliques: 0,
        }
      }

      acc[veiculo].custo += item.custo
      acc[veiculo].impressoes += item.impressoes
      acc[veiculo].cliques += item.cliques

      return acc
    }, {} as Record<string, { veiculo: string; custo: number; impressoes: number; cliques: number }>)

    // Calcular métricas por veículo
    const benchmarks: VehicleBenchmarkMetrics[] = Object.values(groupedByVehicle).map((vehicle) => {
      const cpc = vehicle.cliques > 0 ? vehicle.custo / vehicle.cliques : 0
      const ctr = vehicle.impressoes > 0 ? (vehicle.cliques / vehicle.impressoes) * 100 : 0
      const cpm = vehicle.impressoes > 0 ? (vehicle.custo / vehicle.impressoes) * 1000 : 0

      return {
        veiculo: vehicle.veiculo,
        custo: vehicle.custo,
        impressoes: vehicle.impressoes,
        cliques: vehicle.cliques,
        cpc,
        ctr,
        cpm,
      }
    })

    // Ordenar por veículo
    return benchmarks.sort((a, b) => a.veiculo.localeCompare(b.veiculo))
  }, [flight1Data, selectedPracas])

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((p) => p !== platform)
      } else {
        return [...prev, platform]
      }
    })
  }

  const togglePraca = (praca: string) => {
    setSelectedPracas((prev) => {
      if (prev.includes(praca)) {
        return prev.filter((p) => p !== praca)
      } else {
        return [...prev, praca]
      }
    })
  }

  const validateAndReturnDate = (dateStr: string | undefined): string => {
    if (!dateStr) return ""
    return dateStr
  }

  // Processar dados da API
  useEffect(() => {
    if (apiData?.data?.values) {
      const headers = apiData.data.values[0]
      const rows = apiData.data.values.slice(1)

      const processed: ProcessedData[] = rows
        .map((row: any[]) => {
          const parseNumber = (value: string | undefined): number => {
            if (!value || value === "") return 0
            // Remove R$, pontos e vírgulas, converte para número
            const cleanValue = value
              .toString()
              .replace(/R\$\s?/, "")
              .replace(/\./g, "")
              .replace(",", ".")
            return Number.parseFloat(cleanValue) || 0
          }

          const parseInteger = (value: string | undefined): number => {
            if (!value || value === "") return 0
            // Remove pontos de milhares
            const cleanValue = value.toString().replace(/\./g, "")
            return Number.parseInt(cleanValue) || 0
          }

          return {
            date: row[headers.indexOf("Date")] || "",
            platform: row[headers.indexOf("Veículo")] || "Outros",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            impressions: parseInteger(row[headers.indexOf("Impressions")]),
            cost: parseNumber(row[headers.indexOf("Total spent")]),
            reach: parseInteger(row[headers.indexOf("Reach")]),
            clicks: parseInteger(row[headers.indexOf("Clicks")]),
            frequency: 1, // Será calculado depois
            cpm: 0, // Será calculado depois
            praca: row[headers.indexOf("Praça")] || "Nacional",
          }
        })
        .filter((item: ProcessedData) => item.date && item.impressions > 0)

      setProcessedData(processed)

      // Definir range de datas inicial
      if (processed.length > 0) {
        const validDates = processed
          .map((item) => {
            // Converter data de DD/MM/YYYY para YYYY-MM-DD
            const dateParts = item.date.split("/")
            if (dateParts.length === 3) {
              const [day, month, year] = dateParts
              return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            }
            return item.date
          })
          .filter(Boolean)
          .sort()

        if (validDates.length > 0) {
          setDateRange({
            start: validDates[0],
            end: validDates[validDates.length - 1],
          })
        }
      }
    }
  }, [apiData])

  // Filtrar dados por data
  const [filteredData, setFilteredData] = useState<ProcessedData[]>([])

  useEffect(() => {
    if (processedData.length > 0) {
      let filtered = processedData

      if (dateRange.start && dateRange.end) {
        filtered = filtered.filter((item) => {
          if (!item.date) return false

          // Converter data de DD/MM/YYYY para Date object
          const dateParts = item.date.split("/")
          if (dateParts.length !== 3) return false

          const [day, month, year] = dateParts
          const itemDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)

          return itemDate >= startDate && itemDate <= endDate
        })
      }

      if (selectedPlatforms.length > 0) {
        filtered = filtered.filter((item) => selectedPlatforms.includes(item.platform))
      }

      if (selectedPracas.length > 0) {
        filtered = filtered.filter((item) => selectedPracas.includes(item.praca))
      }

      setFilteredData(filtered)
    } else {
      setFilteredData([])
    }
  }, [processedData, dateRange, selectedPlatforms, selectedPracas])


  // Calcular métricas por plataforma
  const platformMetrics = useMemo(() => {
    const metrics: Record<string, PlatformMetrics> = {}
    const alcancePlatforms = ["TikTok", "Meta", "Uber"]

    // Processar dados de alcance deduplicado para TikTok, Meta e Uber
    if (alcanceDedupData && alcanceDedupData.length > 0) {
      alcanceDedupData.forEach((item) => {
        // Aplicar filtros
        const veiculo = item.veiculo || item.platform || ""
        const matchPraca =
          selectedPracas.length === 0 || selectedPracas.some((p) => p.toLowerCase() === item.praca.toLowerCase())
        const matchPlatform =
          selectedPlatforms.length === 0 ||
          selectedPlatforms.some((p) => p.toLowerCase() === veiculo.toLowerCase())

        if (matchPraca && matchPlatform) {
          if (!metrics[veiculo]) {
            metrics[veiculo] = {
              platform: veiculo,
              impressions: 0,
              cost: 0,
              reach: 0,
              clicks: 0,
              cpm: 0,
              frequency: 0,
              color: platformColors[veiculo] || platformColors.Default,
            }
          }

          metrics[veiculo].impressions += item.impressoes
          metrics[veiculo].reach += item.alcance
        }
      })
    }

    // Processar dados da API consolidada para outras plataformas
    filteredData.forEach((item) => {
      const isAlcancePlatform = alcancePlatforms.some((p) => item.platform.toLowerCase() === p.toLowerCase())

      // Pular plataformas que já foram processadas com dados de alcance deduplicado
      if (isAlcancePlatform) {
        // Se já existe métrica dessa plataforma, adicionar apenas cost e clicks da API consolidada
        if (metrics[item.platform]) {
          metrics[item.platform].cost += item.cost
          metrics[item.platform].clicks += item.clicks
        }
      } else {
        // Para outras plataformas, usar dados completos da API consolidada
        if (!metrics[item.platform]) {
          metrics[item.platform] = {
            platform: item.platform,
            impressions: 0,
            cost: 0,
            reach: 0,
            clicks: 0,
            cpm: 0,
            frequency: 0,
            color: platformColors[item.platform] || platformColors.Default,
          }
        }

        metrics[item.platform].impressions += item.impressions
        metrics[item.platform].cost += item.cost
        metrics[item.platform].reach += item.reach
        metrics[item.platform].clicks += item.clicks
      }
    })

    // Calcular médias
    Object.values(metrics).forEach((metric) => {
      const platformData = filteredData.filter((item) => item.platform === metric.platform)
      const veiculo = metric.platform
      if (platformData.length > 0 || alcanceDedupData?.some((item) => (item.veiculo || item.platform) === veiculo)) {
        metric.cpm = metric.impressions > 0 ? metric.cost / (metric.impressions / 1000) : 0
        metric.frequency = metric.reach > 0 ? metric.impressions / metric.reach : 0
      }
    })

    return Object.values(metrics).sort((a, b) => b.impressions - a.impressions)
  }, [filteredData, alcanceDedupData, selectedPracas, selectedPlatforms, platformColors])

  // Calcular totais
  const totals = useMemo(() => {
    const investment = filteredData.reduce((sum, item) => sum + item.cost, 0)
    const clicks = filteredData.reduce((sum, item) => sum + item.clicks, 0)

    // Usar dados de alcance deduplicado para TikTok, Meta e Uber
    // Para outras plataformas, usar dados da API consolidada
    const alcancePlatforms = ["TikTok", "Meta", "Uber"]
    const filteredDataOtherPlatforms = filteredData.filter(
      (item) => !alcancePlatforms.some((p) => item.platform.toLowerCase() === p.toLowerCase()),
    )
    const reachFromOtherPlatforms = filteredDataOtherPlatforms.reduce((sum, item) => sum + item.reach, 0)
    const impressionsFromOtherPlatforms = filteredDataOtherPlatforms.reduce((sum, item) => sum + item.impressions, 0)

    // Total de alcance = alcance das novas abas + alcance de outras plataformas
    const reach = alcanceMetrics.totalReach + reachFromOtherPlatforms

    // Total de impressões = impressões das novas abas + impressões de outras plataformas
    const impressions = alcanceMetrics.totalImpressions + impressionsFromOtherPlatforms

    // Frequência média = totalImpressions / totalReach
    const frequency = reach > 0 ? impressions / reach : alcanceMetrics.avgFrequency

    const cpm = impressions > 0 ? investment / (impressions / 1000) : 0
    const cpc = clicks > 0 ? investment / clicks : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

    // CPV e VTR são placeholders
    const cpv = 0.06
    const vtr = 65

    return {
      investment,
      impressions,
      reach,
      clicks,
      frequency,
      cpm,
      cpc,
      ctr,
      cpv,
      vtr,
    }
  }, [filteredData, alcanceMetrics])

  // Preparar dados para gráficos
  const impressionsChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.impressions,
    color: metric.color,
  }))

  const reachChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.reach,
    color: metric.color,
  }))

  const frequencyChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.frequency,
    color: metric.color,
  }))

  const cpmChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.cpm,
    color: metric.color,
  }))

  const clicksChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.clicks,
    color: metric.color,
  }))

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} bi`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)} mil`
    }
    return value.toLocaleString("pt-BR")
  }
  
  const formatFullNumber = (value: number): string => {
      return value.toLocaleString("pt-BR");
  }


  // Função para formatar moeda
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }


  // Componente de gráfico de barras horizontal
  const HorizontalBarChart: React.FC<{
    data: ChartDataPoint[]
    title: string
    format?: (value: number) => string
  }> = ({ data, title, format = formatNumber }) => {
    const maxValue = Math.max(...data.map((d) => d.value))

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-16 text-xs text-gray-600 truncate">{item.platform}</div>
              <div className="flex-1 relative">
                <div
                  className="h-6 bg-gray-100 rounded"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
                <div className="absolute right-2 top-0 h-6 flex items-center">
                  <span className="text-xs font-medium text-gray-700">{format(item.value)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Componente do card de benchmarks (Flight 1)
  const BenchmarkCard: React.FC = () => {
    if (flight1Loading) {
      return (
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Benchmarks (Flight 1)</div>
          <div className="text-lg font-bold text-gray-500">Carregando...</div>
        </div>
      )
    }

    if (vehicleBenchmarks.length === 0) {
      return (
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Benchmarks (Flight 1)</div>
          <div className="text-lg font-bold text-gray-500">Nenhum benchmark disponível</div>
        </div>
      )
    }

    return (
      <div className="card-overlay rounded-lg shadow-lg p-6">
        <div className="text-lg font-semibold text-gray-800 mb-4">Benchmarks - Flight 1</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicleBenchmarks.map((benchmark) => (
            <div key={benchmark.veiculo} className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-bold text-gray-800 text-center border-b border-gray-300 pb-2">
                {benchmark.veiculo}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center bg-white rounded p-2">
                  <div className="text-gray-500 text-xs">CPC</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {formatCurrency(benchmark.cpc)}
                  </div>
                </div>
                <div className="text-center bg-white rounded p-2">
                  <div className="text-gray-500 text-xs">CTR</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {benchmark.ctr.toFixed(2)}%
                  </div>
                </div>
                <div className="text-center bg-white rounded p-2 col-span-2">
                  <div className="text-gray-500 text-xs">CPM</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {formatCurrency(benchmark.cpm)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return <Loading message="Carregando visão geral..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
      </div>
    )
  }

  return (
    <div ref={contentRef} className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Visão Geral da Campanha</h1>
            <p className="text-gray-600">Dashboard de performance</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          <PDFDownloadButton contentRef={contentRef} fileName="visao-geral" />
          <span>Última atualização: {new Date().toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Filtro de Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Período
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filtro de Plataformas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Plataformas
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedPlatforms.includes(platform)
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: selectedPlatforms.includes(platform) ? platformColors[platform] + "20" : undefined,
                    borderColor: selectedPlatforms.includes(platform) ? platformColors[platform] : undefined,
                    color: selectedPlatforms.includes(platform) ? platformColors[platform] : undefined,
                  }}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Praças */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              Praças
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePracas.map((praca) => (
                <button
                  key={praca}
                  onClick={() => togglePraca(praca)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedPracas.includes(praca)
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {praca}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Investimento Total</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(totals.investment)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Impressões</div>
          <div className="text-xl font-bold text-blue-600">{formatFullNumber(totals.impressions)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">CPM</div>
          <div className="text-xl font-bold text-purple-600">{formatCurrency(totals.cpm)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Alcance</div>
          <div className="text-xl font-bold text-orange-600">{formatNumber(totals.reach)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Frequência</div>
          <div className="text-xl font-bold text-red-600">{totals.frequency.toFixed(2)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Cliques</div>
          <div className="text-xl font-bold text-teal-600">{formatFullNumber(totals.clicks)}</div>
        </div>
      </div>

      {/* Gráficos de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 flex-1">
        {/* Impressões por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={impressionsChartData} title="Impressões" />
        </div>

        {/* Alcance por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={reachChartData} title="Alcance" />
        </div>

        {/* Frequência por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={frequencyChartData} title="Frequência" format={(value) => value.toFixed(2)} />
        </div>

        {/* CPM por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={cpmChartData} title="CPM Médio" format={(value) => formatCurrency(value)} />
        </div>

        {/* Cliques por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={clicksChartData} title="Cliques" />
        </div>

      </div>

      {/* Card de Benchmarks - Posicionado no final */}
      <div className="w-full">
        <BenchmarkCard />
      </div>
    </div>
  )
}

export default VisaoGeral