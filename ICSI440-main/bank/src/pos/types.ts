import type { Product } from '../data'

export interface OrderLine {
  product: Product
  qty: number
}

export interface Order {
  id: number
  items: OrderLine[]
  total: number
}
