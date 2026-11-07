import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { ItemKind } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import Service from '#models/service'

const { SHOE, BAG, HELMET } = ItemKind
const { MAIN, ADDON } = ServiceType

type ServiceSeed = [string, ServiceType, ItemKind[], number, number, string, boolean?]

const CATALOGUE: ServiceSeed[] = [
  [
    'Mild',
    MAIN,
    [SHOE],
    60000,
    3,
    'Pencucian bagian luar dan dalam untuk menjaga sepatu tetap bersih.',
  ],
  ['Medium', MAIN, [SHOE], 65000, 3, 'Pencucian luar dan dalam untuk noda cenderung ringan.'],
  ['Hard', MAIN, [SHOE], 70000, 4, 'Pencucian luar dan dalam untuk noda berat.'],
  ['Premium for Suede', MAIN, [SHOE], 120000, 5, 'Perawatan khusus sepatu suede.', true],
  ['Kids Shoes', MAIN, [SHOE], 40000, 3, 'Pencucian luar dan dalam untuk sepatu anak.', true],
  ['Just for Her', MAIN, [SHOE], 45000, 3, 'Untuk flat shoes, heels, wedges, dan flip-flop.'],
  ['Premium Repaint', MAIN, [SHOE], 150000, 7, 'Pewarnaan sepatu di bagian upper.', true],
  ['Midsole Repaint / Recolour', MAIN, [SHOE], 180000, 7, 'Pewarnaan bagian midsole sepatu.'],
  ['Unyellowing', ADDON, [SHOE], 30000, 2, 'Menghilangkan warna kuning pada sol.', true],
  ['Sepatu putih / mummy', ADDON, [SHOE], 10000, 0, 'Tambahan untuk sepatu putih.'],
  ['Nubuck / suede', ADDON, [SHOE], 10000, 0, 'Tambahan untuk bahan nubuck dan suede.'],
  ['One Day Service', ADDON, [SHOE], 10000, 0, 'Selesai dalam 1 hari.'],
  ['Tas Small · kanvas', MAIN, [BAG], 40000, 3, 'Tas kanvas atau kain, kurang dari 25 cm.'],
  ['Tas Small · kulit', MAIN, [BAG], 60000, 4, 'Tas kulit atau nubuck, kurang dari 25 cm.'],
  ['Tas Medium · kanvas', MAIN, [BAG], 55000, 3, 'Tas kanvas atau kain, kurang dari 35 cm.'],
  ['Tas Medium · kulit', MAIN, [BAG], 75000, 4, 'Tas kulit atau nubuck, kurang dari 35 cm.'],
  ['Tas Large · kanvas', MAIN, [BAG], 70000, 4, 'Tas kanvas atau kain, kurang dari 60 cm.'],
  ['Tas Large · kulit', MAIN, [BAG], 85000, 5, 'Tas kulit atau nubuck, kurang dari 60 cm.'],
  ['Tas X-Large · kanvas', MAIN, [BAG], 85000, 5, 'Tas kanvas atau kain, lebih dari 60 cm.'],
  ['Tas X-Large · kulit', MAIN, [BAG], 100000, 5, 'Tas kulit atau nubuck, lebih dari 60 cm.'],
  [
    'Helmet Spa Reguler',
    MAIN,
    [HELMET],
    35000,
    2,
    'Busa dalam dilepas, dicuci, dan dikeringkan. Bawa langsung ke toko.',
  ],
  [
    'Helmet Spa Premium',
    MAIN,
    [HELMET],
    70000,
    3,
    'Cuci menyeluruh plus disinfeksi dan pewangi. Bawa langsung ke toko.',
  ],
]

export default class extends BaseSeeder {
  override async run() {
    for (const [
      position,
      [name, type, categories, price, days, description, isStarting],
    ] of CATALOGUE.entries()) {
      await Service.updateOrCreate(
        { name },
        {
          name,
          type,
          categories,
          price,
          days,
          description,
          isStartingPrice: isStarting ?? false,
          isActive: true,
          position,
          deletedAt: null,
        }
      )
    }
  }
}
