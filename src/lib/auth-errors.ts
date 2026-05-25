const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha inválidos.',
  'Email not confirmed': 'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este e-mail já está cadastrado.',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'Rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
  'Invalid email': 'Informe um e-mail válido.',
  'new row violates row-level security': 'Você não tem permissão para realizar esta operação.',
  'permission denied': 'Acesso negado. Verifique suas permissões.',
  'relation does not exist': 'Erro de configuração. Contate o suporte.',
  'duplicate key value violates unique constraint': 'Este registro já existe.',
}

export function translateAuthError(message: string): string {
  return ERROR_MAP[message] || message
}
