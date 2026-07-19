"use client"

import { QRCodeSVG } from "qrcode.react"

interface ReceiptQrCodeProps {
  verificationUrl: string
  size?: number
  className?: string
}

export function ReceiptQrCode({
  verificationUrl,
  size = 128,
  className,
}: ReceiptQrCodeProps) {
  return (
    <div className={className}>
      <QRCodeSVG
        value={verificationUrl}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  )
}
