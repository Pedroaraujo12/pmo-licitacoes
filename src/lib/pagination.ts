export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export function getRange(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to }
}
