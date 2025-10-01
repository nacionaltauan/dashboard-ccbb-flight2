"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { BarChart3, Calendar, Filter, MapPin } from "lucide-react"
import { useConsolidadoNacionalData } from "../../services/api"
import { useBenchmarkNacionalData, processBenchmarkData } from "../../services/benchmarkApi"
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

const VisaoGeral: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: apiData, loading, error } = useConsolidadoNacionalData()
  const { data: benchmarkData } = useBenchmarkNacionalData()
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedPracas, setSelectedPracas] = useState<string[]>([])

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

  // Valores previstos para pacing
  const impressoesPrevistas = 51241352;
  const cliquesPrevistos = 258138;


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

  // Processar dados de benchmark
  const benchmarkMap = useMemo(() => {
    if (benchmarkData?.data) {
      return processBenchmarkData(benchmarkData.data)
    }
    return new Map()
  }, [benchmarkData])

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

  // Identificar veículos disponíveis nos dados filtrados
  const availableVehicles = useMemo(() => {
    const vehicles = new Set<string>()
    filteredData.forEach((item) => {
      vehicles.add(item.platform)
    })
    return Array.from(vehicles)
  }, [filteredData])

  // Obter benchmarks para veículos disponíveis
  const vehicleBenchmarks = useMemo(() => {
    const benchmarks: Array<{
      vehicle: string
      mediaType: string
      cpm: number
      cpc: number
      ctr: number
      vtr: number
    }> = []

    availableVehicles.forEach((vehicle) => {
      // Mapear veículo para chave do benchmark
      let benchmarkKey = ""
      if (vehicle === "Meta") {
        benchmarkKey = "META"
      } else if (vehicle === "TikTok") {
        benchmarkKey = "TIK TOK"
      } else {
        // Para outros veículos, usar o nome como está
        benchmarkKey = vehicle.toUpperCase()
      }

      // Buscar benchmarks para DISPLAY e VÍDEO
      const displayKey = `${benchmarkKey}_DISPLAY`
      const videoKey = `${benchmarkKey}_VÍDEO`

      const displayBenchmark = benchmarkMap.get(displayKey)
      const videoBenchmark = benchmarkMap.get(videoKey)

      if (displayBenchmark) {
        benchmarks.push({
          vehicle,
          mediaType: "DISPLAY",
          cpm: displayBenchmark.cpm || 0,
          cpc: displayBenchmark.cpc || 0,
          ctr: displayBenchmark.ctr || 0,
          vtr: displayBenchmark.completionRate || 0,
        })
      }

      if (videoBenchmark) {
        benchmarks.push({
          vehicle,
          mediaType: "VÍDEO",
          cpm: videoBenchmark.cpm || 0,
          cpc: videoBenchmark.cpc || 0,
          ctr: videoBenchmark.ctr || 0,
          vtr: videoBenchmark.completionRate || 0,
        })
      }
    })

    return benchmarks
  }, [availableVehicles, benchmarkMap])

  // Calcular métricas por plataforma
  const platformMetrics = useMemo(() => {
    const metrics: Record<string, PlatformMetrics> = {}

    filteredData.forEach((item) => {
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
    })

    // Calcular médias
    Object.values(metrics).forEach((metric) => {
      const platformData = filteredData.filter((item) => item.platform === metric.platform)
      if (platformData.length > 0) {
        metric.cpm = metric.cost / (metric.impressions / 1000)
        metric.frequency = metric.reach > 0 ? metric.impressions / metric.reach : 0
      }
    })

    return Object.values(metrics).sort((a, b) => b.impressions - a.impressions)
  }, [filteredData])

  // Calcular totais
  const totals = useMemo(() => {
    const investment = filteredData.reduce((sum, item) => sum + item.cost, 0)
    const impressions = filteredData.reduce((sum, item) => sum + item.impressions, 0)
    const reach = filteredData.reduce((sum, item) => sum + item.reach, 0)
    const clicks = filteredData.reduce((sum, item) => sum + item.clicks, 0)
    const frequency = reach > 0 ? impressions / reach : 0
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
  }, [filteredData])

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
  
    // Componente para card de métrica com Pacing
  const PacingMetricCard: React.FC<{
    label: string;
    value: number;
    predictedValue: number;
    format: (val: number) => string;
    mainColorClass: string;
  }> = ({ label, value, predictedValue, format, mainColorClass }) => {
    const percentageDiff = predictedValue > 0 ? ((value - predictedValue) / predictedValue) * 100 : 0;
    const isAbove = percentageDiff >= 0;
    const diffColorClass = isAbove ? "text-green-600" : "text-red-600";
    const arrow = isAbove ? "↑" : "↓";

    return (
      <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
        <div className="text-sm text-gray-600 mb-1">{label}</div>
        <div className={`text-xl font-bold ${mainColorClass}`}>{format(value)}</div>
        <div className="text-xs text-gray-500 mt-1">
          <span>Previsto: {format(predictedValue)}</span>
          <span className={`ml-2 font-semibold ${diffColorClass}`}>
             ({arrow} {Math.abs(percentageDiff).toFixed(1)}%)
          </span>
        </div>
      </div>
    );
  };


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

  // Componente do card de benchmarks
  const BenchmarkCard: React.FC = () => {
    if (vehicleBenchmarks.length === 0) {
      return (
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Benchmarks</div>
          <div className="text-lg font-bold text-gray-500">Nenhum benchmark disponível</div>
        </div>
      )
    }

    // Agrupar por veículo
    const groupedBenchmarks = vehicleBenchmarks.reduce((acc, benchmark) => {
      if (!acc[benchmark.vehicle]) {
        acc[benchmark.vehicle] = []
      }
      acc[benchmark.vehicle].push(benchmark)
      return acc
    }, {} as Record<string, typeof vehicleBenchmarks>)

    return (
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="text-sm font-medium text-gray-700 mb-3">Benchmarks de Mercado</div>
        <div className="space-y-3">
          {Object.entries(groupedBenchmarks).map(([vehicle, benchmarks]) => (
            <div key={vehicle} className="space-y-2">
              <div className="text-xs font-semibold text-gray-800 border-b border-gray-200 pb-1">
                {vehicle}
              </div>
              {benchmarks.map((benchmark, index) => (
                <div key={index} className="ml-3 space-y-1">
                  <div className="text-xs font-medium text-gray-600">
                    {benchmark.mediaType}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-gray-500">CPM</div>
                      <div className="font-semibold text-blue-600">
                        {formatCurrency(benchmark.cpm || 0)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500">CPC</div>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(benchmark.cpc || 0)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500">CTR</div>
                      <div className="font-semibold text-purple-600">
                        {(benchmark.ctr || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500">VTR</div>
                      <div className="font-semibold text-orange-600">
                        {(benchmark.vtr || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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

        <PacingMetricCard
            label="Impressões"
            value={totals.impressions}
            predictedValue={impressoesPrevistas}
            format={formatFullNumber}
            mainColorClass="text-blue-600"
        />

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

        <PacingMetricCard
            label="Cliques"
            value={totals.clicks}
            predictedValue={cliquesPrevistos}
            format={formatFullNumber}
            mainColorClass="text-teal-600"
        />
      </div>

      {/* Card de Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <BenchmarkCard />
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
    </div>
  )
}

export default VisaoGeral