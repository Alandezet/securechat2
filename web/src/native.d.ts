interface Window {
  cipherBack?: () => boolean
  CipherAndroid?: {
    configureRelay(): void
    saveFile(dataUrl: string, filename: string): void
  }
}
