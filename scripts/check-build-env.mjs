#!/usr/bin/env node
/**
 * Falha o build quando faltam as variáveis do Supabase.
 *
 * O projeto usa `output: "export"`, então NEXT_PUBLIC_* são embutidas no
 * bundle em tempo de build. Sem elas o build TERMINA COM SUCESSO e gera um
 * site que quebra no navegador: createClient() lança "Configuração do
 * Supabase ausente" e toda tela do dashboard cai no error boundary.
 *
 * Isso já derrubou a produção uma vez. O sintoma (páginas 200, app morto)
 * não aparece em nenhuma verificação de HTTP — só abrindo o site.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OBRIGATORIAS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const ARQUIVOS_ENV = ['.env.local', '.env.production', '.env']

/** Lê as chaves definidas nos arquivos .env, sem sobrescrever process.env. */
function chavesEmArquivos() {
  const encontradas = new Set()

  for (const nome of ARQUIVOS_ENV) {
    const caminho = resolve(process.cwd(), nome)
    if (!existsSync(caminho)) continue

    for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
      const limpa = linha.trim()
      if (!limpa || limpa.startsWith('#')) continue
      const igual = limpa.indexOf('=')
      if (igual < 1) continue
      const chave = limpa.slice(0, igual).trim()
      const valor = limpa.slice(igual + 1).trim()
      if (valor) encontradas.add(chave)
    }
  }
  return encontradas
}

const emArquivo = chavesEmArquivos()
const faltando = OBRIGATORIAS.filter(k => !process.env[k] && !emArquivo.has(k))

if (faltando.length > 0) {
  console.error('\n\x1b[31m✖ Build interrompido: variáveis de ambiente ausentes\x1b[0m\n')
  for (const k of faltando) console.error(`  - ${k}`)
  console.error(`
Sem essas variáveis o build gera um site que sobe normalmente e quebra no
navegador — as páginas respondem 200, mas o app não inicia.

Como resolver:

  1. Crie um arquivo .env.local na raiz do projeto:

       NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
       NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave publishable/anon>

     Os valores estão em Supabase Dashboard → Project Settings → API.

  2. Ou exporte no ambiente antes de buildar (CI, Cloudflare Pages):

       Settings → Environment variables, no projeto do Pages.
`)
  process.exit(1)
}

console.log('✓ Variáveis de build do Supabase presentes')
