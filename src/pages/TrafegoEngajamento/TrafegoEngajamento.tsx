"use client"

import type React from "react"
import { useState, useMemo, useRef } from "react"
import { TrendingUp, Calendar, Users, BarChart3, MessageCircle, HandHeart } from "lucide-react"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import { 
  useGA4ResumoNacionalData, 
  useGA4CompletoNacionalData, 
  useGA4SourceNacionalData,
  useEventosReceptivosData 
} from "../../services/api"
import BrazilMap from "../../components/BrazilMap/BrazilMap" // Importar novo componente de mapa

type TrafegoEngajamentoProps = {}

// Mapeamento explícito dos nomes dos estados da API para os nomes no GeoJSON
const API_TO_GEOJSON_STATE_NAMES: { [key: string]: string } = {
  Ceara: "Ceará",
  "Federal District": "Distrito Federal",
  "State of Acre": "Acre",
  "State of Alagoas": "Alagoas",
  "State of Amapa": "Amapá",
  "State of Amazonas": "Amazonas",
  "State of Bahia": "Bahia",
  "State of Espirito Santo": "Espírito Santo",
  "State of Goias": "Goiás",
  "State of Maranhao": "Maranhão",
  "State of Mato Grosso": "Mato Grosso",
  "State of Mato Grosso do Sul": "Mato Grosso do Sul",
  "State of Minas Gerais": "Minas Gerais",
  "State of Para": "Pará",
  "State of Paraiba": "Paraíba",
  "State of Parana": "Paraná",
  "State of Pernambuco": "Pernambuco",
  "State of Piaui": "Piauí",
  "State of Rio de Janeiro": "Rio de Janeiro",
  "State of Rio Grande do Norte": "Rio Grande do Norte",
  "State of Rio Grande do Sul": "Rio Grande do Sul",
  "State of Rondonia": "Rondônia",
  "State of Roraima": "Roraima",
  "State of Santa Catarina": "Santa Catarina",
  "State of Sao Paulo": "São Paulo",
  "State of Sergipe": "Sergipe",
  "State of Tocantins": "Tocantins",
  "Upper Takutu-Upper Essequibo": "Outros", // This isn't a Brazilian state
}

const TrafegoEngajamento: React.FC<TrafegoEngajamentoProps> = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: ga4ResumoData, loading: resumoLoading, error: resumoError } = useGA4ResumoNacionalData()
  const { data: ga4CompletoData, loading: completoLoading, error: completoError } = useGA4CompletoNacionalData()
  const { data: ga4SourceData, loading: sourceLoading, error: sourceError } = useGA4SourceNacionalData()
  const { data: eventosReceptivosData, loading: eventosLoading, error: eventosError } = useEventosReceptivosData()


  console.log("Dados ga4ResumoData:", ga4ResumoData)

  // Função para formatar a data como YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Adiciona um zero à esquerda se necessário
    const day = String(today.getDate()).padStart(2, '0'); // Adiciona um zero à esquerda se necessário
    return `${year}-${month}-${day}`;
  };

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "2025-07-28",
    end: getTodayDateString(), // Define o 'end' como a data de hoje
  })

  // Função para verificar se uma data está dentro do range selecionado
  const isDateInRange = (dateStr: string): boolean => {
    if (!dateStr || !dateRange.start || !dateRange.end) return true

    // Converter string de data para formato comparável (YYYY-MM-DD)
    const date = new Date(dateStr).toISOString().split("T")[0]
    const startDate = new Date(dateRange.start).toISOString().split("T")[0]
    const endDate = new Date(dateRange.end).toISOString().split("T")[0]

    return date >= startDate && date <= endDate
  }

  // Função para obter cor do veículo/plataforma
  const getPlataformaColor = (source: string): string => {
    const colors: { [key: string]: string } = {
      "meta": "#1877f2",
      "facebook": "#1877f2", 
      "instagram": "#E4405F",
      "tiktok": "#ff0050",
      "youtube": "#ff0000",
      "google": "#4285f4",
      "criteo": "#ff6900",
      "dms-social": "#1877f2",
      "dms-google": "#4285f4",
      "dms-youtube": "#ff0000",
      "organic": "#6b7280",
      "(not set)": "#9ca3af",
      "Outros": "#9ca3af",
    }
    
    // Converter para lowercase para match
    const lowerSource = source.toLowerCase()
    return colors[lowerSource] || "#6b7280"
  }

  // Processamento dos dados da API GA4 Source (nova funcionalidade) com filtro de data
  const processedSourceData = useMemo(() => {
    
    // CORREÇÃO: Verificar se existe data.values ao invés de só values
    if (!ga4SourceData?.data?.values || ga4SourceData.data.values.length <= 1) {

      return {
        veiculosDetalhados: [],
        fontesPorPlataforma: {},
        totalSessions: 0,
        resumoPorData: {},
      }
    }

    // CORREÇÃO: Acessar ga4SourceData.data.values
    const headers = ga4SourceData.data.values[0]
    const rows = ga4SourceData.data.values.slice(1)


    // Índices das colunas
    const dateIndex = headers.indexOf("Date")
    const campaignIndex = headers.indexOf("User campaign name")
    const sourceIndex = headers.indexOf("Session manual source")
    const sessionsIndex = headers.indexOf("Sessions")


    const sourceData: { [key: string]: number } = {}
    const dataResumo: { [key: string]: number } = {}
    let totalSessions = 0

    rows.forEach((row: any[], index: number) => {
      const date = row[dateIndex] || ""

     
      // Aplicar filtro de data
      if (!isDateInRange(date)) {
       
        return
      }

      const sessions = Number.parseInt(row[sessionsIndex]) || 0
      const source = row[sourceIndex] || "Outros" // USAR SOURCE em vez de plataforma
      const campaign = row[campaignIndex] || "(not set)"

      if (sessions > 0) {
        totalSessions += sessions

        // Agrupar por SOURCE em vez de plataforma
        sourceData[source] = (sourceData[source] || 0) + sessions

        // Resumo por data
        if (date) {
          dataResumo[date] = (dataResumo[date] || 0) + sessions
        }

      }
    })

    // Converter em arrays ordenados usando SOURCE
    const veiculosDetalhados = Object.entries(sourceData)
      .map(([source, sessoes]) => ({
        plataforma: source, // manter nome da propriedade para compatibilidade
        sessoes,
        percentual: totalSessions > 0 ? (sessoes / totalSessions) * 100 : 0,
        cor: getPlataformaColor(source),
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    return {
      veiculosDetalhados,
      fontesPorPlataforma: sourceData,
      totalSessions,
      resumoPorData: dataResumo,
    }
  }, [ga4SourceData, dateRange])

  const processedEventosData = useMemo(() => {
  if (!eventosReceptivosData?.data?.values || eventosReceptivosData.data.values.length <= 1) {
    return {
      bbTrack: 0,
      firstVisit: 0,
      totalCTAs: 0,
    }
  }

  const headers = eventosReceptivosData.data.values[0]
  const rows = eventosReceptivosData.data.values.slice(1)

  // Índices das colunas
  const dateIndex = headers.indexOf("Date")
  const eventNameIndex = headers.indexOf("Event name") 
  const eventCountIndex = headers.indexOf("Event count")

  let bbTrackTotal = 0
  let firstVisitTotal = 0

  rows.forEach((row: any[]) => {
    const date = row[dateIndex] || ""
    
    // Aplicar filtro de data
    if (!isDateInRange(date)) {
      return
    }

    const eventName = row[eventNameIndex] || ""
    const eventCount = parseInt(row[eventCountIndex]) || 0

    // Mapear eventos para categorias
    if (eventName === "bbTrack") {
      bbTrackTotal += eventCount
    } else if (eventName === "first_visit") {
      firstVisitTotal += eventCount
    }
  })

  return {
    bbTrack: bbTrackTotal,
    firstVisit: firstVisitTotal,
    totalCTAs: bbTrackTotal + firstVisitTotal,
  }
}, [eventosReceptivosData, dateRange])

  const processedResumoData = useMemo(() => {
    
    // CORREÇÃO: Verificar se existe data.values ao invés de só values
    if (!ga4ResumoData?.data?.values || ga4ResumoData.data.values.length <= 1) {
      return {
        receptivo: {
          sessoesCampanha: 0,
          cliquesSaibaMais: 0,
          cliquesCTAs: 0,
          duracaoSessoes: "00:00:00",
          taxaRejeicao: 0,
          cliquesWhatsapp: 0,
          cliquesContrateAgora: 0,
          cliquesFaleConosco: 0,
        },
        dispositivos: [],
        dadosRegiao: {},
      }
    }

    // CORREÇÃO: Acessar ga4ResumoData.data.values
    const headers = ga4ResumoData.data.values[0]
    const rows = ga4ResumoData.data.values.slice(1)


    // Índices das colunas
    const dateIndex = headers.indexOf("Date")
    const regionIndex = headers.indexOf("Region")
    const deviceIndex = headers.indexOf("Device category")
    const sessionsIndex = headers.indexOf("Sessions")
    const bounceRateIndex = headers.indexOf("Bounce rate")
    const avgDurationIndex = headers.indexOf("Average session duration")
    
    // Novos CTAs
    const whatsappIndex = headers.indexOf("Key event count for clique_whatsapp_flutuante")
    const contrateAgoraIndex = headers.indexOf("Key event count for clique_cta_contrate_agora")
    const faleConoscoIndex = headers.indexOf("Key event count for clique_cta_fale_com_a_gente")

    let totalSessions = 0
    let totalSaibaMais = 0
    let totalDuration = 0
    let totalBounceRate = 0
    let validRows = 0
    let totalCTAs = 0
    let totalWhatsapp = 0
    let totalContrateAgora = 0
    let totalFaleConosco = 0

    const deviceData: { [key: string]: number } = {}
    const regionData: { [key: string]: number } = {}

    rows.forEach((row: any[], index: number) => {
      const date = row[dateIndex] || ""
      
      // Aplicar filtro de data
      if (!isDateInRange(date)) {
        return
      }

      const sessions = Number.parseInt(row[sessionsIndex]) || 0
      const duration = Number.parseFloat(row[avgDurationIndex]) || 0
      const bounceRate = Number.parseFloat(row[bounceRateIndex]) || 0
      const device = row[deviceIndex] || "Outros"
      const region = row[regionIndex] || "Outros"
      
      // Novos CTAs
      const whatsapp = Number.parseInt(row[whatsappIndex]) || 0
      const contrateAgora = Number.parseInt(row[contrateAgoraIndex]) || 0
      const faleConosco = Number.parseInt(row[faleConoscoIndex]) || 0

      totalWhatsapp += whatsapp
      totalContrateAgora += contrateAgora
      totalFaleConosco += faleConosco
      totalCTAs += whatsapp + contrateAgora + faleConosco

      if (sessions > 0) {
        totalSessions += sessions
        totalDuration += duration * sessions
        totalBounceRate += bounceRate * sessions
        validRows += sessions

        // Dispositivos
        deviceData[device] = (deviceData[device] || 0) + sessions

        // Regiões - Converter o nome do estado para o formato esperado pelo mapa
        if (region !== "(not set)" && region.trim() !== "" && region !== " " && region !== "Outros") {
          const normalizedRegion = API_TO_GEOJSON_STATE_NAMES[region] || region
          regionData[normalizedRegion] = (regionData[normalizedRegion] || 0) + sessions
        } else {
        }
      }
    })
   

    // Converter em arrays ordenados
    const dispositivos = Object.entries(deviceData)
      .map(([tipo, sessoes]) => ({
        tipo,
        sessoes,
        percentual: totalSessions > 0 ? (sessoes / totalSessions) * 100 : 0,
        cor: tipo === "mobile" ? "#3b82f6" : tipo === "desktop" ? "#8b5cf6" : "#06b6d4",
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    // Converter duração para formato hh:mm:ss
    const avgDurationSec = validRows > 0 ? totalDuration / validRows : 0
    const hours = Math.floor(avgDurationSec / 3600)
    const minutes = Math.floor((avgDurationSec % 3600) / 60)
    const seconds = Math.floor(avgDurationSec % 60)
    const duracaoFormatada = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    const avgBounceRate = validRows > 0 ? (totalBounceRate / validRows) * 100 : 0

    const resultado = {
      receptivo: {
        sessoesCampanha: totalSessions,
        cliquesSaibaMais: totalSaibaMais,
        cliquesCTAs: totalCTAs,
        duracaoSessoes: duracaoFormatada,
        taxaRejeicao: avgBounceRate,
        cliquesWhatsapp: totalWhatsapp,
        cliquesContrateAgora: totalContrateAgora,
        cliquesFaleConosco: totalFaleConosco,
      },
      dispositivos,
      dadosRegiao: regionData,
    }

    return resultado
  }, [ga4ResumoData, dateRange])

  // Processamento dos dados da NOVA API GA4 Completo (para os novos cards) com filtro de data
  const processedCompletoData = useMemo(() => {
    
    
    // CORREÇÃO: Verificar se existe data.values ao invés de só values
    if (!ga4CompletoData?.data?.values || ga4CompletoData.data.values.length <= 1) {
      return {
        totalSessions: 0,
        totalEvents: 0,
      }
    }

    // CORREÇÃO: Acessar ga4CompletoData.data.values
    const headers = ga4CompletoData.data.values[0]
    const rows = ga4CompletoData.data.values.slice(1)

    

    const dateIndex = headers.indexOf("Date")
    const sessionsIndex = headers.indexOf("Sessions")
    const eventCountIndex = headers.indexOf("Event count")

    

    let totalSessions = 0
    let totalEvents = 0

    rows.forEach((row: any[], index: number) => {
      const date = row[dateIndex] || ""
     
      // Aplicar filtro de data
      if (!isDateInRange(date)) {
        return
      }

      const sessions = Number.parseInt(row[sessionsIndex]) || 0
      const events = Number.parseInt(row[eventCountIndex]) || 0

      totalSessions += sessions
      totalEvents += events

    })
    
    return {
      totalSessions,
      totalEvents,
    }
  }, [ga4CompletoData, dateRange])

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} mil`
    }
    return value.toLocaleString("pt-BR")
  }

  // Componente de gráfico de barras horizontais
  const HorizontalBarChart: React.FC<{
    title: string
    data: Array<{
      categoria?: string
      tipo?: string
      plataforma?: string
      campanha?: string
      sessoes: number
      percentual: number
      cor?: string
    }>
    showValues?: boolean
  }> = ({ title, data, showValues = true }) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.categoria || item.tipo || item.plataforma || item.campanha}
              </span>
              {showValues && (
                <span className="text-sm text-gray-600">
                  {formatNumber(item.sessoes)} ({item.percentual.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(item.percentual, 100)}%`,
                  backgroundColor: item.cor || "#6b7280",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (resumoLoading || completoLoading || sourceLoading || eventosLoading) {
  return <Loading message="Carregando dados de tráfego e engajamento..." />
}

  if (resumoError || completoError || sourceError || eventosError) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-2">Erro ao carregar dados</div>
        <p className="text-gray-600">Não foi possível carregar os dados do GA4. Tente novamente.</p>
        {resumoError && <p className="text-xs text-red-400">{resumoError.message}</p>}
        {completoError && <p className="text-xs text-red-400">{completoError.message}</p>}
        {sourceError && <p className="text-xs text-red-400">{sourceError.message}</p>}
        {eventosError && <p className="text-xs text-red-400">{eventosError.message}</p>}
      </div>
    )
  }

  return (
    <div ref={contentRef} className="space-y-6 h-full flex flex-col">
      {/* Título e Botão de Download */}
        <div className="flex justify-between items-center">
            {/* Lado Esquerdo: Ícone e Título */}
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Tráfego e Engajamento</h1>
                    <p className="text-xs text-gray-600">Receptivo da campanha</p>
                </div>
            </div>
            {/* Lado Direito: Botão */}
            <PDFDownloadButton contentRef={contentRef} fileName="trafego-e-engajamento" />
        </div>
      
      {/* Header Compacto com Filtro de Data e Cards de Métricas */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Filtro de Data */}
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Período de Análise
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cards de Métricas - 4 cards ocupando 9 colunas */}
          <div className="col-span-9 grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Sessões Campanha</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatNumber(processedResumoData.receptivo.sessoesCampanha)}
                    
                  </p>
                </div>
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">bbTrack</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatNumber(processedEventosData.bbTrack)}
                  </p>
                </div>
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">First Visit</p>
                  <p className="text-lg font-bold text-orange-900">
                    {formatNumber(processedEventosData.firstVisit)}
                  </p>
                </div>
                <HandHeart className="w-6 h-6 text-orange-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-yellow-600">Sessões Totais</p>
                  <p className="text-lg font-bold text-yellow-900">
                  {formatNumber(processedSourceData.totalSessions)}
                  </p>
                </div>
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Período selecionado - linha inferior */}
        <div className="mt-2 text-xs text-gray-500">
          Período selecionado: {new Date(dateRange.start).toLocaleDateString("pt-BR")} até{" "}
          {new Date(dateRange.end).toLocaleDateString("pt-BR")} | Última atualização:{" "}
          {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Dispositivos */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Dispositivo" data={processedResumoData.dispositivos} />
        </div>

        {/* Plataformas Detalhadas (Nova funcionalidade) */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Plataformas - Sessões Detalhadas" data={processedSourceData.veiculosDetalhados} />
        </div>

        {/* Mapa de Calor - Usando o novo componente */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <BrazilMap
            regionData={processedResumoData.dadosRegiao}
            getIntensityColor={(sessions) => {
              const values = Object.values(processedResumoData.dadosRegiao)
              const maxSessions = values.length > 0 ? Math.max(...values) : 0

              if (sessions === 0 || maxSessions === 0) return "#e5e7eb"

              const intensity = sessions / maxSessions

              const colors = {
                muitoAlta: "#03045E",
                alta: "#023E8A",
                medio: "#0077B6",
                baixa: "#0096C7",
                muitoBaixa: "#00B4D8",
              }

              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result
                  ? {
                      r: Number.parseInt(result[1], 16),
                      g: Number.parseInt(result[2], 16),
                      b: Number.parseInt(result[3], 16),
                    }
                  : { r: 0, g: 0, b: 0 }
              }

              const rgbToHex = (r: number, g: number, b: number) => {
                return (
                  "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)
                )
              }

              const interpolateColor = (color1: string, color2: string, factor: number) => {
                const rgb1 = hexToRgb(color1)
                const rgb2 = hexToRgb(color2)

                const r = rgb1.r + (rgb2.r - rgb1.r) * factor
                const g = rgb1.g + (rgb2.g - rgb1.g) * factor
                const b = rgb1.b + (rgb2.b - rgb1.b) * factor

                return rgbToHex(r, g, b)
              }

              if (intensity >= 0.8) {
                const factor = (intensity - 0.8) / 0.2
                return interpolateColor(colors.alta, colors.muitoAlta, factor)
              } else if (intensity >= 0.6) {
                const factor = (intensity - 0.6) / 0.2
                return interpolateColor(colors.medio, colors.alta, factor)
              } else if (intensity >= 0.4) {
                const factor = (intensity - 0.4) / 0.2
                return interpolateColor(colors.baixa, colors.medio, factor)
              } else if (intensity >= 0.2) {
                const factor = (intensity - 0.2) / 0.2
                return interpolateColor(colors.muitoBaixa, colors.baixa, factor)
              } else {
                return colors.muitoBaixa
              }
            }}
          />
        </div>
      </div>

      /* Resumo dos CTAs */
    <div className="card-overlay rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo de Conversões (CTAs)</h3>
      
      {/* GRID CONTAINER PARA OS 2 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CARD BBTRACK */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <MessageCircle className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-700">bbTrack</span>
            </div>
            <span className="text-2xl font-bold text-blue-900">
              {formatNumber(processedEventosData.bbTrack)}
            </span>
          </div>
          <p className="text-xs text-blue-600">
            {processedResumoData.receptivo.sessoesCampanha > 0 
              ? `${((processedEventosData.bbTrack / processedResumoData.receptivo.sessoesCampanha) * 100).toFixed(2)}% das sessões`
              : '0% das sessões'
            }
          </p>
        </div>

        {/* CARD FIRST VISIT */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <HandHeart className="w-5 h-5 text-orange-600 mr-2" />
              <span className="text-sm font-medium text-orange-700">First Visit</span>
            </div>
            <span className="text-2xl font-bold text-orange-900">
              {formatNumber(processedEventosData.firstVisit)}
            </span>
          </div>
          <p className="text-xs text-orange-600">
            {processedResumoData.receptivo.sessoesCampanha > 0 
              ? `${((processedEventosData.firstVisit / processedResumoData.receptivo.sessoesCampanha) * 100).toFixed(2)}% das sessões`
              : '0% das sessões'
            }
          </p>
        </div>
      </div>


        {/* Total de CTAs */}
        <div className="mt-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Total de Eventos CTA's</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-gray-900">
                {formatNumber(processedEventosData.totalCTAs)}
              </span>
              <p className="text-xs text-gray-600">
                {processedResumoData.receptivo.sessoesCampanha > 0 
                  ? `${((processedEventosData.totalCTAs / processedResumoData.receptivo.sessoesCampanha) * 100).toFixed(2)}% taxa de conversão`
                  : '0% taxa de conversão'
                }
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Observações */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Fontes:</strong> GA4 Resumo, GA4 Completo e GA4 Source (API Nacional). Os dados são atualizados automaticamente.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          <strong>Filtro de Data:</strong> Os dados são filtrados automaticamente com base no período selecionado. Todos
          os gráficos e métricas refletem apenas os dados do período escolhido.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          <strong>Novos CTAs:</strong> bbTrack e First Visit são as principais conversões monitoradas.
        </p>
      </div>
    </div>
  )
}

export default TrafegoEngajamento