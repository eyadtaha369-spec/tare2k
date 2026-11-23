"use client";
import { QRCodeSVG } from "qrcode.react";

export default function PassQR({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={220} level="M" marginSize={2} fgColor="#111111" />;
}
