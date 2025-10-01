import { API_NACIONAL_URL_v2, PLATFORM_FOLDERS } from "./api"

// Cache para armazenar mídias já carregadas
const mediaCache = new Map<string, Map<string, { url: string, type: string }>>()

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  size?: string
}

export const googleDriveApi = {
  // Buscar arquivos de uma pasta específica
  async getFolderFiles(folderId: string): Promise<DriveFile[]> {
    try {
      const response = await fetch(`${API_NACIONAL_URL_v2}/google/drive/folder/${folderId}/files`)
      const data = await response.json()

      if (data.success) {
        return data.data
      }
      throw new Error("Failed to fetch folder files")
    } catch (error) {
      console.error("Error fetching folder files:", error)
      return []
    }
  },

  // Buscar detalhes de um arquivo específico
  async getFileDetails(fileId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_NACIONAL_URL_v2}/google/drive/file/${fileId}`)
      const data = await response.json()

      if (data.success && data.data.webViewLink) {
        // Converter Google Drive view link para diferentes formatos
        const baseLink = data.data.webViewLink
        
        // Para imagens: usar direct image link
        if (data.data.mimeType?.startsWith('image/')) {
          return `https://drive.google.com/file/d/${fileId}/preview`
        }
        
        // Para vídeos: usar embed link
        if (data.data.mimeType?.startsWith('video/')) {
          return `https://drive.google.com/file/d/${fileId}/preview`
        }

        return baseLink.replace("/view?usp=drivesdk", "/preview")
      }
      return null
    } catch (error) {
      console.error("Error fetching file details:", error)
      return null
    }
  },

  // Buscar imagens para uma plataforma específica
  async getPlatformImages(platform: "meta" | "pinterest" | "tiktok"): Promise<Map<string, { url: string, type: string }>> {
    const cacheKey = platform

    // Verificar cache primeiro
    if (mediaCache.has(cacheKey)) {
      console.log(`📦 [DEBUG] Cache encontrado para ${platform}`)
      return mediaCache.get(cacheKey)!
    }

    const folderId = PLATFORM_FOLDERS[platform]
    console.log(`🔍 [DEBUG] Buscando arquivos na pasta ${platform}: ${folderId}`)
    const files = await this.getFolderFiles(folderId)
    console.log(`📁 [DEBUG] Arquivos encontrados na pasta:`, files.length)

    // Filtrar apenas arquivos de mídia
    const mediaFiles = files.filter((file) => 
      file.mimeType.startsWith("image/") || 
      file.mimeType.startsWith("video/")
    )

    const mediaMap = new Map<string, { url: string, type: string }>()

    // Buscar webViewLink para cada arquivo
    for (const file of mediaFiles) {
      const mediaUrl = await this.getFileDetails(file.id)
      if (mediaUrl) {
        const cleanName = this.cleanCreativeName(file.name)
        const mediaType = file.mimeType.startsWith('video/') ? 'video' : 'image'
        mediaMap.set(cleanName, { url: mediaUrl, type: mediaType })
      }
    }

    // Armazenar no cache
    mediaCache.set(cacheKey, mediaMap)

    return mediaMap
  },

  // Limpar nome do criativo para matching
  cleanCreativeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|mp4|gif|mov|avi|webm)$/i, "") // Remove extensões
      .replace(/[^a-z0-9\s]/g, " ") // Substitui caracteres especiais por espaços
      .replace(/\s+/g, " ") // Remove espaços múltiplos
      .trim()
  },

  // Melhorar algoritmo de matching
  findMediaForCreative(creativeName: string, mediaMap: Map<string, { url: string, type: string }>): { url: string, type: string } | null {
    if (!creativeName) return null
    
    const cleanCreativeName = this.cleanCreativeName(creativeName)
    const creativeWords = cleanCreativeName.split(" ").filter(word => word.length > 2)
    console.log(`🔍 [DEBUG] Procurando mídia para: "${creativeName}" -> Limpo: "${cleanCreativeName}" -> Palavras: [${creativeWords.join(", ")}]`)

    // 1. Busca exata primeiro
    if (mediaMap.has(cleanCreativeName)) {
      return mediaMap.get(cleanCreativeName)!
    }

    // 2. Busca por correspondência exata de palavras-chave
    for (const [mediaName, mediaData] of Array.from(mediaMap.entries())) {
      const mediaWords = mediaName.split(" ").filter(word => word.length > 2)
      
      // Verificar se todas as palavras do criativo estão no nome da mídia
      const allWordsMatch = creativeWords.every(word => 
        mediaWords.some(mediaWord => mediaWord.includes(word) || word.includes(mediaWord))
      )
      
      if (allWordsMatch && creativeWords.length > 0) {
        return mediaData
      }
    }

    // 3. Busca parcial por similaridade
    let bestMatch: { url: string, type: string } | null = null
    let bestScore = 0

    for (const [mediaName, mediaData] of Array.from(mediaMap.entries())) {
      const score = this.calculateSimilarity(cleanCreativeName, mediaName)
      if (score > bestScore && score > 0.3) { // Threshold mínimo de 30%
        bestScore = score
        bestMatch = mediaData
      }
    }

    return bestMatch
  },

  // Calcular similaridade entre duas strings
  calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(" ").filter(word => word.length > 2)
    const words2 = str2.split(" ").filter(word => word.length > 2)
    
    if (words1.length === 0 || words2.length === 0) return 0

    let matches = 0
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matches++
          break
        }
      }
    }

    return matches / Math.max(words1.length, words2.length)
  },

  // Gerar URL para thumbnail de vídeo do Google Drive
  getVideoThumbnail(fileId: string): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200-h200`
  },

  // Limpar cache
  clearCache() {
    mediaCache.clear()
  },

  // Função para invalidar cache de uma plataforma específica
  clearPlatformCache(platform: "meta" | "pinterest" | "tiktok") {
    mediaCache.delete(platform)
  }
}