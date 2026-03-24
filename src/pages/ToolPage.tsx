import { Download, ImageIcon, Trash2, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShareModal, isShareDismissed } from '@/components/ShareModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/pages/PageHeader'

type OutputFormat = 'original' | 'jpeg' | 'png' | 'webp'

interface ImageItem {
  id: string
  file: File
  originalSize: number
  originalName: string
  thumbnailUrl: string
  compressedBlob: Blob | null
  compressedSize: number | null
  compressedUrl: string | null
  status: 'pending' | 'compressing' | 'done'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getMimeType(format: OutputFormat, originalType: string): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      return originalType === 'image/gif' ? 'image/png' : originalType
  }
}

function getExtension(format: OutputFormat, originalName: string): string {
  switch (format) {
    case 'jpeg':
      return 'jpg'
    case 'png':
      return 'png'
    case 'webp':
      return 'webp'
    default: {
      const ext = originalName.split('.').pop()?.toLowerCase()
      return ext || 'png'
    }
  }
}

async function compressImage(
  file: File,
  quality: number,
  format: OutputFormat
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const mime = getMimeType(format, file.type)
      const qualityParam = mime === 'image/png' ? undefined : quality / 100

      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Compression failed'))
          }
        },
        mime,
        qualityParam
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export function ToolPage() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [quality, setQuality] = useState(80)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original')
  const [shareOpen, setShareOpen] = useState(false)
  const [hasCompressed, setHasCompressed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: ImageItem[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        originalSize: file.size,
        originalName: file.name,
        thumbnailUrl: URL.createObjectURL(file),
        compressedBlob: null,
        compressedSize: null,
        compressedUrl: null,
        status: 'pending',
      })
    }
    setImages(prev => [...prev, ...newItems])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
        e.target.value = ''
      }
    },
    [addFiles]
  )

  const handleCompress = useCallback(async () => {
    const pending = images.filter(img => img.status === 'pending')
    if (pending.length === 0) return

    for (const img of pending) {
      setImages(prev =>
        prev.map(i => (i.id === img.id ? { ...i, status: 'compressing' } : i))
      )
      try {
        const blob = await compressImage(img.file, quality, outputFormat)
        const blobUrl = URL.createObjectURL(blob)
        setImages(prev =>
          prev.map(i =>
            i.id === img.id
              ? {
                  ...i,
                  compressedBlob: blob,
                  compressedSize: blob.size,
                  compressedUrl: blobUrl,
                  status: 'done',
                }
              : i
          )
        )
      } catch {
        setImages(prev =>
          prev.map(i => (i.id === img.id ? { ...i, status: 'pending' } : i))
        )
      }
    }

    if (!hasCompressed && !isShareDismissed()) {
      setHasCompressed(true)
      setShareOpen(true)
    }
  }, [images, quality, outputFormat, hasCompressed])

  const handleDownload = useCallback(
    (img: ImageItem) => {
      if (!img.compressedUrl || !img.compressedBlob) return
      const ext = getExtension(outputFormat, img.originalName)
      const baseName = img.originalName.replace(/\.[^.]+$/, '')
      const a = document.createElement('a')
      a.href = img.compressedUrl
      a.download = `${baseName}-compressed.${ext}`
      a.click()
    },
    [outputFormat]
  )

  const handleDownloadAll = useCallback(() => {
    const done = images.filter(img => img.status === 'done')
    for (const img of done) {
      handleDownload(img)
    }
  }, [images, handleDownload])

  const handleRemove = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.thumbnailUrl)
        if (img.compressedUrl) URL.revokeObjectURL(img.compressedUrl)
      }
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const handleRemoveAll = useCallback(() => {
    for (const img of images) {
      URL.revokeObjectURL(img.thumbnailUrl)
      if (img.compressedUrl) URL.revokeObjectURL(img.compressedUrl)
    }
    setImages([])
  }, [images])

  const hasPending = images.some(img => img.status === 'pending')
  const hasCompressing = images.some(img => img.status === 'compressing')
  const doneCount = images.filter(img => img.status === 'done').length

  return (
    <div className="space-y-8">
      <PageHeader />

      <div className="mx-auto max-w-4xl px-4 pb-8">
        {/* Controls */}
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-end gap-6">
            {/* Quality slider */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="quality-slider" className="mb-2 block">
                {t('tool.quality')}: {quality}%
              </Label>
              <input
                id="quality-slider"
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Output format */}
            <div className="min-w-[160px]">
              <Label className="mb-2 block">{t('tool.format')}</Label>
              <Select
                value={outputFormat}
                onValueChange={v => setOutputFormat(v as OutputFormat)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">{t('tool.keepOriginal')}</SelectItem>
                  <SelectItem value="jpeg">{t('tool.jpeg')}</SelectItem>
                  <SelectItem value="png">{t('tool.png')}</SelectItem>
                  <SelectItem value="webp">{t('tool.webp')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleCompress}
                disabled={!hasPending || hasCompressing}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {hasCompressing ? t('tool.compressing') : t('tool.compress')}
              </Button>
              {doneCount > 1 && (
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Download className="mr-1.5 size-4" />
                  {t('tool.downloadAll')}
                </Button>
              )}
              {images.length > 0 && (
                <Button variant="outline" onClick={handleRemoveAll}>
                  <Trash2 className="mr-1.5 size-4" />
                  {t('tool.removeAll')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragging
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-muted-foreground/30 hover:border-orange-400 hover:bg-accent/50'
          }`}
        >
          <Upload className="mb-3 size-10 text-muted-foreground" />
          <p className="text-muted-foreground">{t('tool.dropImage')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* Image list */}
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="mb-3 size-12" />
            <p>{t('tool.noImages')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {images.map(img => (
              <Card key={img.id} className="flex items-center gap-4 p-4">
                {/* Thumbnail */}
                <img
                  src={img.thumbnailUrl}
                  alt={img.originalName}
                  className="size-16 flex-shrink-0 rounded-md object-cover"
                />

                {/* Info */}
                <div className="min-w-0 flex-1" dir="ltr">
                  <p className="truncate font-medium text-sm">
                    {img.originalName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('tool.originalSize')}: {formatFileSize(img.originalSize)}
                  </p>
                  {img.status === 'compressing' && (
                    <p className="text-orange-500 text-xs">{t('tool.compressing')}</p>
                  )}
                  {img.status === 'done' && img.compressedSize != null && (
                    <p className="text-xs">
                      <span className="text-green-600 dark:text-green-400">
                        {t('tool.compressedSize')}: {formatFileSize(img.compressedSize)}
                      </span>
                      {' - '}
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {Math.max(
                          0,
                          Math.round(
                            ((img.originalSize - img.compressedSize) /
                              img.originalSize) *
                              100
                          )
                        )}
                        % {t('tool.saved')}
                      </span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {img.status === 'done' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(img)}
                    >
                      <Download className="mr-1 size-3.5" />
                      {t('tool.download')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(img.id)}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">{t('tool.remove')}</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        showDismissOption
      />
    </div>
  )
}
