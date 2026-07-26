import crypto from 'crypto'

// Garanta que tem a palavra 'export' aqui no início:
export function gerarSenhaProvisoria(tamanho = 12): string {
  const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
  let senha = ''
  const bytes = crypto.randomBytes(tamanho)
  
  for (let i = 0; i < tamanho; i++) {
    senha += caracteres[bytes[i] % caracteres.length]
  }
  return senha
}