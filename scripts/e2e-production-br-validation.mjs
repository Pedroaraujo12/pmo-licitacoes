import { chromium } from 'playwright'

const base = process.env.E2E_BASE_URL || 'https://pmo-licitacoes.pages.dev'

const email = process.env.E2E_EMAIL
const pass = process.env.E2E_PASSWORD

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext()
const page = await context.newPage()
const findings = []

function addFinding(type, message) {
  findings.push({ type, url: page.url(), message })
  console.log(`[${type}] ${message}`)
}

page.on('console', msg => {
  if (msg.type() === 'error') addFinding('CONSOLE_ERROR', msg.text().slice(0, 240))
})
page.on('pageerror', err => addFinding('PAGE_ERROR', err.message.slice(0, 240)))
page.on('response', res => {
  if (res.status() >= 400) {
    const url = res.url()
    if (!url.includes('google') && !url.includes('fonts')) {
      addFinding(`HTTP_${res.status()}`, url.slice(0, 240))
    }
  }
})

async function textLength() {
  return page.evaluate(() => (document.body?.innerText || '').trim().length)
}

async function assertLoaded(name, min = 80) {
  await page.waitForTimeout(1200)
  const len = await textLength()
  console.log(`${name}: ${page.url()} len=${len}`)
  if (len < min) throw new Error(`${name} não carregou conteúdo suficiente: len=${len}`)
}

async function login() {
  if (!email || !pass) {
    throw new Error('Defina E2E_EMAIL e E2E_PASSWORD para executar a validação E2E.')
  }

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.fill('input[type=email], input[name=email]', email)
  await page.fill('input[type=password], input[name=password]', pass)
  await page.locator('button:has-text("Entrar"), button[type=submit]').first().click()
  await page.waitForTimeout(5000)
  if (!page.url().includes('/pmo-dashboard')) {
    throw new Error('Login E2E falhou.')
  }
  console.log('login: ok')
}

try {
  await page.goto(`${base}/reset-password`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await assertLoaded('reset-password-invalid-link')
  const invalidResetVisible = await page.getByText('Link de redefinição inválido ou expirado.').isVisible()
  const invalidResetDisabled = await page.getByRole('button', { name: 'Link inválido' }).isVisible()
  console.log('reset-invalid-link-visible:', invalidResetVisible)
  console.log('reset-invalid-link-disabled:', invalidResetDisabled)
  if (!invalidResetVisible || !invalidResetDisabled) {
    throw new Error('Reset de senha sem token não bloqueou envio com erro claro')
  }

  await login()
  await assertLoaded('dashboard')
  const fluxoHeaders = await page.evaluate(() => {
    const title = Array.from(document.querySelectorAll('h2'))
      .find(node => node.textContent?.trim() === 'Fluxo de Execução')
    const card = title?.closest('.glass-card')
    return Array.from(card?.querySelectorAll('thead th') || [])
      .map(node => node.textContent?.trim() || '')
  })
  console.log('fluxo-execucao-headers:', JSON.stringify(fluxoHeaders))
  if (!fluxoHeaders.includes('Atividade Atual')) {
    throw new Error('Fluxo de Execução não exibiu a coluna Atividade Atual')
  }
  if (!fluxoHeaders.includes('Observações')) {
    throw new Error('Fluxo de Execução não exibiu a coluna Observações')
  }
  for (const removedHeader of ['Status', 'Prior.', 'Responsável', 'Data']) {
    if (fluxoHeaders.includes(removedHeader)) {
      throw new Error(`Fluxo de Execução ainda exibiu a coluna removida: ${removedHeader}`)
    }
  }
  const firstEditButton = page.locator('button[title="Editar"]').first()
  await firstEditButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  if (await firstEditButton.count()) {
    await firstEditButton.click()
    await assertLoaded('processo-editar')
    const observacoesField = page.locator('textarea[name="observacoes"], textarea[aria-label="Observações"]').first()
    await observacoesField.waitFor({ state: 'visible', timeout: 10000 })
    console.log('processo-editar-observacoes-visible:', true)
  }

  await page.goto(`${base}/pmo-dashboard/colaboradores/novo`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('colaboradores-novo')
  const newDateInputs = await page.locator('input[placeholder="dd/mm/aaaa"]').evaluateAll(nodes =>
    nodes.map(node => ({ type: node.type, value: node.value, placeholder: node.getAttribute('placeholder') })),
  )
  console.log('colaboradores-novo-date-inputs:', JSON.stringify(newDateInputs))
  if (newDateInputs.length < 2 || newDateInputs.some(input => input.type !== 'text')) {
    throw new Error('Campos de data de colaborador novo não estão como texto dd/mm/aaaa')
  }
  await page.fill('input[placeholder="Nome Completo"]', 'Teste Data ISO Sem Gravar')
  await page.locator('input[placeholder="dd/mm/aaaa"]').first().fill('1988-05-27')
  await page.locator('button:has-text("Salvar")').first().click()
  await page.waitForTimeout(800)
  const isoRejected = await page.getByText('Data de nascimento inválida. Use dd/mm/aaaa.').isVisible()
  console.log('colaborador-iso-rejected:', isoRejected)
  if (!isoRejected) throw new Error('Campo de data aceitou ISO em colaborador novo')

  await page.goto(`${base}/pmo-dashboard/processos`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('processos')
  const processDateInputsBefore = await page.locator('input[placeholder="dd/mm/aaaa"]').evaluateAll(nodes =>
    nodes.map(node => ({ type: node.type, value: node.value })),
  )
  if (processDateInputsBefore.some(input => input.type !== 'text')) {
    throw new Error('Filtros de data de processos não estão como texto')
  }
  const todayButtons = page.getByRole('button', { name: 'Hoje' })
  if (await todayButtons.count()) {
    await todayButtons.first().click()
    await page.waitForTimeout(600)
    const values = await page.locator('input[placeholder="dd/mm/aaaa"]').evaluateAll(nodes => nodes.map(node => node.value))
    console.log('processos-hoje-values:', JSON.stringify(values))
    if (!values.every(value => /^\d{2}\/\d{2}\/\d{4}$/.test(value))) {
      throw new Error('Atalho Hoje dos filtros de processos não preencheu dd/mm/aaaa')
    }
  }

  await page.goto(`${base}/pmo-dashboard/notas`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('notas')
  const noteButton = page.getByRole('button', { name: 'Nova anotação' })
  if (await noteButton.count()) {
    await noteButton.first().click()
    await page.waitForTimeout(500)
    const noteDateCount = await page.locator('input[placeholder="dd/mm/aaaa"]').count()
    console.log('notas-date-input-count:', noteDateCount)
    if (noteDateCount < 1) throw new Error('Modal de notas não expôs data em dd/mm/aaaa')
    await page.keyboard.press('Escape').catch(() => {})
  }

  await page.goto(`${base}/pmo-dashboard/cronograma`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('cronograma')
  const cronogramaCards = page.locator('div[style*="cursor: pointer"]')
  if (await cronogramaCards.count()) {
    await cronogramaCards.first().click()
    await page.waitForTimeout(2500)
    await assertLoaded('cronograma-detalhe')
    if (!page.url().includes('/pmo-dashboard/processos/detalhe?id=')) {
      throw new Error(`Clique no cronograma não navegou para detalhe por query param: ${page.url()}`)
    }
    const stillLoading = await page.evaluate(() => (document.body?.innerText || '').includes('Carregando...'))
    console.log('cronograma-detail-still-loading:', stillLoading)
    if (stillLoading) throw new Error('Detalhe aberto pelo cronograma ficou em carregamento')
  }

  await page.goto(`${base}/pmo-dashboard/ordens-servico`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('ordens-servico')

  await page.goto(`${base}/pmo-dashboard/colaboradores`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('colaboradores')
  const colCards = page.locator('div[style*="cursor: pointer"], table tbody tr')
  if (await colCards.count()) {
    await colCards.first().click()
    await page.waitForTimeout(2500)
    await assertLoaded('colaborador-detalhe')
    const editButton = page.getByRole('button', { name: 'Editar' })
    if (await editButton.count()) {
      await editButton.first().click()
      await page.waitForTimeout(700)
      const editDateInputs = await page.locator('input[placeholder="dd/mm/aaaa"]').evaluateAll(nodes =>
        nodes.map(node => ({ type: node.type, value: node.value })),
      )
      console.log('colaborador-edit-date-inputs:', JSON.stringify(editDateInputs))
      if (editDateInputs.length < 1 || editDateInputs.some(input => input.type !== 'text')) {
        throw new Error('Edição de colaborador não usa data textual dd/mm/aaaa')
      }
      await page.locator('button:has-text("Salvar")').first().click()
      await page.waitForTimeout(2200)
      const saveError = await page.getByText('Erro ao salvar alterações').isVisible().catch(() => false)
      console.log('colaborador-save-error-visible:', saveError)
      if (saveError) throw new Error('Erro ao salvar alterações ainda aparece na edição de colaborador')
    }
  }

  await page.goto(`${base}/pmo-dashboard`, { waitUntil: 'networkidle', timeout: 60000 })
  await assertLoaded('dashboard-before-logout')
  const logoutButton = page.getByRole('button', { name: 'Sair' })
  if (await logoutButton.count()) {
    await logoutButton.first().click()
    await page.waitForTimeout(1500)
  } else {
    throw new Error('Botão de logout não encontrado')
  }
  const loggedOut = page.url().includes('/login')
  console.log('logout-redirected-login:', loggedOut)
  if (!loggedOut) throw new Error(`Logout não redirecionou para login: ${page.url()}`)

  await page.goto(`${base}/pmo-dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const protectedRedirected = page.url().includes('/login')
  console.log('protected-route-after-logout:', protectedRedirected)
  if (!protectedRedirected) throw new Error(`Rota protegida acessível após logout: ${page.url()}`)

  console.log('FINDINGS_TOTAL=' + findings.length)
  console.log('FINDINGS_JSON=' + JSON.stringify(findings, null, 2))
  if (findings.length > 0) throw new Error('Foram encontrados erros de console/rede/página')
} catch (err) {
  console.error('E2E_FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await browser.close()
}
