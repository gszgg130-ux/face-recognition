export type Currency = 'MNT' | 'EUR'

export interface Account {
  id: string
  name: string
  oldNumber: string
  iban: string
  currency: Currency
}

export interface Transaction {
  id: number
  date: string
  title: string
}

export type Tab = 'home' | 'qr' | 'transfer' | 'services'

export const MASKED_BALANCE = '******.**'

/** The account shown on the home screen and preselected for transfers. */
export const PRIMARY_ACCOUNT_ID = 'main'

export const accounts: Account[] = [
  {
    id: 'eur',
    name: 'Харилцах данс',
    oldNumber: 'MN18 000400 0822023322',
    iban: 'MN130004004003908592',
    currency: 'EUR',
  },
  {
    id: 'main',
    name: '888',
    oldNumber: 'MN13 000400 0822023315',
    iban: 'MN520004004003834267',
    currency: 'MNT',
  },
  {
    id: 'mnt',
    name: 'Харилцах данс',
    oldNumber: 'MN13 000400 0822024964',
    iban: 'MN730004004003845044',
    currency: 'MNT',
  },
]

export const transactions: Transaction[] = [
  { id: 1, date: '2026-10-30 12:34:16', title: 'POS Purchase - CU-13 BAIGAL TUV' },
  { id: 2, date: '2026-10-29 09:15:17', title: 'POS Purchase - CU-13 BAIGAL TUV' },
  { id: 3, date: '2026-10-28 18:02:41', title: 'POS Purchase - CU-13 BAIGAL TUV' },
  { id: 4, date: '2026-10-27 15:16:18', title: 'POS Purchase - CU-13 BAIGAL TUV' },
]

export function findAccount(id: string): Account {
  const account = accounts.find((a) => a.id === id)
  if (!account) throw new Error(`Unknown account id: ${id}`)
  return account
}

/** The signed-in customer. `name` is the backend (MongoDB) user name. */
export const CURRENT_USER = { name: 'Enkhluun', displayName: 'ЭНХЛҮҮН' }

/** The store where the POS terminal is installed (matches the card statement above). */
export const MERCHANT = { id: 'CU-13 BAIGAL TUV', name: 'CU-13 Байгал төв', terminalId: 'T-0413' }

export interface Product {
  id: string
  name: string
  price: number
  color: string
}

export const products: Product[] = [
  { id: 'water', name: 'Ус 0.5л', price: 1500, color: '#5ac8fa' },
  { id: 'kimbap', name: 'Кимбап', price: 4500, color: '#34c759' },
  { id: 'ramen', name: 'Шин рамён', price: 3200, color: '#ff3b30' },
  { id: 'coffee', name: 'Латте', price: 5900, color: '#a2845e' },
  { id: 'banana', name: 'Гадил сүү', price: 3500, color: '#ffcc00' },
  { id: 'choco', name: 'Шоколад', price: 2800, color: '#8e5b3a' },
  { id: 'sandwich', name: 'Сэндвич', price: 6500, color: '#ff9500' },
  { id: 'gum', name: 'Бохь', price: 1200, color: '#af52de' },
]
