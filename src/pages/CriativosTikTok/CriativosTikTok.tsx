"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { Calendar, MapPin } from "lucide-react"
import { useTikTokNacionalData } from "../../services/api"
import Loading from "../../components/Loading/Loading"
import { googleDriveApi } from "../../services/googleDriveApi"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import MediaThumbnail from "../../components/MediaThumbnail/MediaThumbnail" // Importe o novo componente
import TikTokCreativeModal from "./components/TikTokCreativeModal" // Importe o modal
import { useBenchmarkNacionalData, processBenchmarkData, calculateVariation } from "../../services/benchmarkApi"

interface CreativeData {
  date: string
  campaignName: string
  adGroupName: string
  adName: string
  adText: string
  videoThumbnailUrl: string
  impressions: number
  clicks: number
  cost: number
  cpc: number
  cpm: number
  reach: number
  frequency: number
  results: number
  videoViews: number
  twoSecondVideoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoViews100: number
  profileVisits: number
  paidLikes: number
  paidComments: number
  paidShares: number
  paidFollows: number
}

const CriativosTikTok: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: apiData, loading, error } = useTikTokNacionalData()
  const { data: benchmarkData, loading: benchmarkLoading } = useBenchmarkNacionalData()
  const [processedData, setProcessedData] = useState<CreativeData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedPracas, setSelectedPracas] = useState<string[]>([])
  const [availablePracas, setAvailablePracas] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  

  const [creativeMedias, setCreativeMedias] = useState<Map<string, { url: string, type: string }>>(new Map())
  const [mediasLoading, setMediasLoading] = useState(false)

  const [selectedCreative, setSelectedCreative] = useState<CreativeData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Processar dados de benchmark
  const benchmarkMap = useMemo(() => {
    if (benchmarkData?.data) {
      return processBenchmarkData(benchmarkData.data)
    }
    return new Map()
  }, [benchmarkData])

  // Função para determinar se é vídeo ou display
  const getMediaType = (creative: CreativeData): string => {
    return creative.videoViews > 0 || creative.videoViews100 > 0 ? "VÍDEO" : "DISPLAY"
  }

  // Função para obter dados de benchmark
  const getBenchmarkData = (creative: CreativeData) => {
    const mediaType = getMediaType(creative)
    const key = `TIK TOK_${mediaType}`
    return benchmarkMap.get(key)
  }

  useEffect(() => {
    const loadMedias = async () => {
      setMediasLoading(true)
      try {
        const mediaMap = await googleDriveApi.getPlatformImages("tiktok")
        setCreativeMedias(mediaMap)
      } catch (error) {
        console.error("Error loading TikTok medias:", error)
      } finally {
        setMediasLoading(false)
      }
    }

    loadMedias()
  }, [])

  useEffect(() => {
    const values = apiData?.data?.values
    if (!values || values.length <= 1) return

    const headers = values[0]
    const rows = values.slice(1)

    const parseNumber = (v: string) => {
      if (!v?.trim()) return 0
      const clean = v
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
      return isNaN(+clean) ? 0 : +clean
    }

    const parseInteger = (v: string) => {
      if (!v?.trim()) return 0
      const clean = v.replace(/\./g, "").replace(",", "")
      const n = Number.parseInt(clean, 10)
      return isNaN(n) ? 0 : n
    }

    const mapped: CreativeData[] = rows.map((row: string[]) => {
      const get = (field: string) => {
        const idx = headers.indexOf(field)
        return idx >= 0 ? (row[idx] ?? "") : ""
      }
      return {
        date: get("Date"),
        campaignName: get("Campaign name"),
        adGroupName: get("Ad group name"),
        adName: get("Ad name"),
        adText: get("Ad text"),
        videoThumbnailUrl: get("Video thumbnail URL"),
        impressions: parseInteger(get("Impressions")),
        clicks: parseInteger(get("Clicks")),
        cost: parseNumber(get("Cost")),
        cpc: parseNumber(get("CPC")),
        cpm: parseNumber(get("CPM")),
        reach: parseInteger(get("Reach")),
        frequency: parseNumber(get("Frequency")),
        results: parseInteger(get("Results")),
        videoViews: parseInteger(get("Video views")),
        twoSecondVideoViews: parseInteger(get("2-second video views")),
        videoViews25: parseInteger(get("Video views at 25%")),
        videoViews50: parseInteger(get("Video views at 50%")),
        videoViews75: parseInteger(get("Video views at 75%")),
        videoViews100: parseInteger(get("Video views at 100%")),
        profileVisits: parseInteger(get("Profile visits")),
        paidLikes: parseInteger(get("Paid likes")),
        paidComments: parseInteger(get("Paid comments")),
        paidShares: parseInteger(get("Paid shares")),
        paidFollows: parseInteger(get("Paid follows")),
      }
    })

    const processed: CreativeData[] = mapped.filter((item: CreativeData): item is CreativeData => Boolean(item.date))

    setProcessedData(processed)

    const allDates = processed.map((i) => new Date(i.date)).sort((a, b) => a.getTime() - b.getTime())

    if (allDates.length > 0) {
      setDateRange({
        start: allDates[0].toISOString().slice(0, 10),
        end: allDates[allDates.length - 1].toISOString().slice(0, 10),
      })
    }

    // Detectar praças disponíveis baseadas nos criativos
    const pracaSet = new Set<string>()
    processed.forEach((item) => {
      const detectedPraca = detectPracaFromCreative(item.adName)
      if (detectedPraca) {
        pracaSet.add(detectedPraca)
      }
    })
    const pracas = Array.from(pracaSet).filter(Boolean).sort()
    setAvailablePracas(pracas)
  }, [apiData])

  // Função para detectar praça baseada no nome do criativo
  const detectPracaFromCreative = (adName: string): string | null => {
    if (!adName) return null
    
    const upperAdName = adName.toUpperCase()
    
    // Regras para São Paulo
    if (upperAdName.includes("SP MEME")) {
      return "São Paulo"
    }
    
    // Regras para Belo Horizonte
    if (upperAdName.includes("BH FULLGAS")) {
      return "Belo Horizonte"
    }
    
    return null
  }

  const togglePraca = (praca: string) => {
    setSelectedPracas((prev) => {
      if (prev.includes(praca)) {
        return prev.filter((p) => p !== praca)
      }
      return [...prev, praca]
    })
  }

  // 3. ATUALIZAÇÃO DA LÓGICA DE FILTRAGEM
  const filteredData = useMemo(() => {
    let filtered = processedData

    // Filtro por data (lógica existente)
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.date)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        return itemDate >= startDate && itemDate <= endDate
      })
    }

    // Filtro por praça
    if (selectedPracas.length > 0) {
      filtered = filtered.filter((item) => {
        const detectedPraca = detectPracaFromCreative(item.adName)
        return detectedPraca && selectedPracas.includes(detectedPraca)
      })
    }

    const groupedData: Record<string, CreativeData> = {}
    filtered.forEach((item) => {
      const key = `${item.adName}_${item.videoThumbnailUrl || "no-thumbnail"}`
      if (!groupedData[key]) {
        groupedData[key] = { ...item }
      } else {
        // Agrupamento de métricas (lógica existente)
        groupedData[key].impressions += item.impressions
        groupedData[key].clicks += item.clicks
        groupedData[key].cost += item.cost
        groupedData[key].reach += item.reach
        groupedData[key].results += item.results
        groupedData[key].videoViews += item.videoViews
        groupedData[key].twoSecondVideoViews += item.twoSecondVideoViews
        groupedData[key].videoViews25 += item.videoViews25
        groupedData[key].videoViews50 += item.videoViews50
        groupedData[key].videoViews75 += item.videoViews75
        groupedData[key].videoViews100 += item.videoViews100
        groupedData[key].profileVisits += item.profileVisits
        groupedData[key].paidLikes += item.paidLikes
        groupedData[key].paidComments += item.paidComments
        groupedData[key].paidShares += item.paidShares
        groupedData[key].paidFollows += item.paidFollows
      }
    })

    const finalData = Object.values(groupedData).map((item) => ({
      ...item,
      cpm: item.impressions > 0 ? item.cost / (item.impressions / 1000) : 0,
      cpc: item.clicks > 0 ? item.cost / item.clicks : 0,
      frequency: item.reach > 0 ? item.impressions / item.reach : 0,
    }))

    finalData.sort((a, b) => b.cost - a.cost)

    return finalData
  }, [processedData, dateRange, selectedPracas])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredData.slice(startIndex, endIndex)
  }, [filteredData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const totals = useMemo(() => {
    return {
      investment: filteredData.reduce((sum, item) => sum + item.cost, 0),
      impressions: filteredData.reduce((sum, item) => sum + item.impressions, 0),
      reach: filteredData.reduce((sum, item) => sum + item.reach, 0),
      clicks: filteredData.reduce((sum, item) => sum + item.clicks, 0),
      videoViews: filteredData.reduce((sum, item) => sum + item.videoViews, 0),
      videoViews100: filteredData.reduce((sum, item) => sum + item.videoViews100, 0),
      paidLikes: filteredData.reduce((sum, item) => sum + item.paidLikes, 0),
      avgCpm: 0,
      avgCpc: 0,
      avgFrequency: 0,
      ctr: 0,
      vtr: 0,
    }
  }, [filteredData])

  if (filteredData.length > 0) {
    totals.avgCpm = totals.impressions > 0 ? totals.investment / (totals.impressions / 1000) : 0
    totals.avgCpc = totals.clicks > 0 ? totals.investment / totals.clicks : 0
    totals.avgFrequency = totals.reach > 0 ? totals.impressions / totals.reach : 0
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    totals.vtr = totals.impressions > 0 ? (totals.videoViews100 / totals.impressions) * 100 : 0
  }

  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString("pt-BR")
  }

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }


  const openCreativeModal = (creative: CreativeData) => {
    const driveMediaData = googleDriveApi.findMediaForCreative(creative.adName, creativeMedias)
    
    const creativeWithMedia = {
      ...creative,
      mediaUrl: driveMediaData?.url || creative.videoThumbnailUrl || undefined
    }
    
    setSelectedCreative(creativeWithMedia)
    setIsModalOpen(true)
  }

  const closeCreativeModal = () => {
    setIsModalOpen(false)
    setSelectedCreative(null)
  }

  if (loading) {
    return <Loading message="Carregando criativos TikTok..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
        <p className="text-red-500 text-sm mt-2">
          Verifique se a API está funcionando corretamente:
          https://nacional-api-gray.vercel.app/google/sheets/1tdFuCDyh1RDvhv9EGoZVJTBiHLSSOk-uUjp5rSbMUgg/data?range=TikTok
        </p>
      </div>
    )
  }

  return (
    <div ref={contentRef} className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">TikTok - Criativos</h1>
            <p className="text-gray-600">Performance dos criativos na plataforma TikTok</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-4 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            <PDFDownloadButton contentRef={contentRef} fileName="criativos-tiktok" />
            <button
              onClick={async () => {
                setMediasLoading(true)
                try {
                  googleDriveApi.clearPlatformCache("tiktok")
                  const mediaMap = await googleDriveApi.getPlatformImages("tiktok")
                  setCreativeMedias(mediaMap)
                } catch (error) {
                  console.error("Erro ao recarregar mídias TikTok:", error)
                } finally {
                  setMediasLoading(false)
                }
              }}
              className="px-3 py-1 bg-pink-500 text-white rounded text-sm hover:bg-pink-600"
            >
              🔄 Recarregar Mídias
            </button>
            <span>Última atualização: {new Date().toLocaleString("pt-BR")}</span>
          </div>
        </div>
      </div>

      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>
          </div>

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
                      ? "bg-pink-100 text-pink-800 border border-pink-300"
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">CPC</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.avgCpc)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">CTR</div>
          <div className="text-lg font-bold text-gray-900">{totals.ctr.toFixed(2)}%</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">VTR</div>
          <div className="text-lg font-bold text-gray-900">{totals.vtr.toFixed(2)}%</div>
        </div>
      </div>

      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-pink-600 text-white">
                <th className="text-left py-3 px-4 font-semibold w-[5rem]">Mídia</th>
                <th className="text-left py-3 px-4 font-semibold">Criativo</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Impressões</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Alcance</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Cliques</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Views 100%</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Likes</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">VTR</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[4rem]">Δ CPM</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[4rem]">Δ CPC</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[4rem]">Δ CTR</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((creative, index) => {
                const vtr = creative.impressions > 0 ? (creative.videoViews100 / creative.impressions) * 100 : 0
                const driveMediaData = googleDriveApi.findMediaForCreative(creative.adName, creativeMedias)
                const tiktokThumbnail = creative.videoThumbnailUrl
                const benchmark = getBenchmarkData(creative)
                
                // Calcular métricas para comparação
                const cpm = creative.impressions > 0 ? (creative.cost / creative.impressions) * 1000 : 0
                const cpc = creative.clicks > 0 ? creative.cost / creative.clicks : 0
                const ctr = creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0
                
                // Calcular variações
                const cpmVariation = benchmark ? calculateVariation(cpm, benchmark.cpm, 'cost') : { value: "-", color: "text-gray-500" }
                const cpcVariation = benchmark ? calculateVariation(cpc, benchmark.cpc, 'cost') : { value: "-", color: "text-gray-500" }
                const ctrVariation = benchmark ? calculateVariation(ctr, benchmark.ctr, 'performance') : { value: "-", color: "text-gray-500" }

                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-pink-50" : "bg-white"}>
                    <td className="py-3 px-4 w-[5rem]">
                      {driveMediaData ? (
                        <MediaThumbnail
                          mediaData={driveMediaData}
                          creativeName={creative.adName}
                          isLoading={mediasLoading}
                          size="md"
                          onClick={() => openCreativeModal(creative)}
                        />
                      ) : tiktokThumbnail ? (
                        <div 
                          className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center relative cursor-pointer group"
                          onClick={() => openCreativeModal(creative)}
                        >
                          <img
                            src={tiktokThumbnail}
                            alt="Thumbnail TikTok"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                              if (target.parentElement) {
                                target.parentElement.innerHTML =
                                  '<div class="text-gray-400 text-xs text-center">Sem mídia</div>'
                              }
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-40">
                            <div className="bg-white bg-opacity-90 rounded-full p-2 shadow-sm">
                              <svg className="w-4 h-4 text-gray-700 fill-gray-700" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MediaThumbnail
                          mediaData={null}
                          creativeName={creative.adName}
                          isLoading={mediasLoading}
                          size="md"
                          onClick={() => openCreativeModal(creative)}
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight whitespace-normal break-words">
                          {creative.adName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-tight whitespace-normal break-words">
                          {creative.campaignName}
                        </p>
                        {creative.adText && (
                          <p className="text-xs text-gray-400 mt-1 leading-tight whitespace-normal break-words">
                            {creative.adText.length > 100 ? creative.adText.substring(0, 100) + "..." : creative.adText}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold min-w-[7.5rem]">
                      {formatCurrency(creative.cost)}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.impressions)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.reach)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.clicks)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.videoViews100)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.paidLikes)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{vtr.toFixed(2)}%</td>
                    <td className={`py-3 px-4 text-right min-w-[4rem] text-xs font-medium ${cpmVariation.color}`}>
                      {cpmVariation.value}
                    </td>
                    <td className={`py-3 px-4 text-right min-w-[4rem] text-xs font-medium ${cpcVariation.color}`}>
                      {cpcVariation.value}
                    </td>
                    <td className={`py-3 px-4 text-right min-w-[4rem] text-xs font-medium ${ctrVariation.color}`}>
                      {ctrVariation.value}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} criativos
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>

      <TikTokCreativeModal 
        creative={selectedCreative}
        isOpen={isModalOpen}
        onClose={closeCreativeModal}
      />
    </div>
  )
}

export default CriativosTikTok