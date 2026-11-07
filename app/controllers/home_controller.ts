import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ItemKindLabel, STORE_ONLY_ITEM_KINDS, type ItemKind } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import BillingService from '#services/billing_service'
import ServiceAreaTransformer from '#transformers/service_area_transformer'
import AreaService from '#services/area_service'

@inject()
export default class HomeController {
  constructor(
    protected billing: BillingService,
    protected area: AreaService
  ) {}

  async show({ inertia }: HttpContext) {
    const services = await this.billing.activePriceList()
    const prices = Object.entries(ItemKindLabel).map(([kind, label]) => {
      const matching = services.filter((service) =>
        service.categories.includes(kind as keyof typeof ItemKindLabel)
      )
      const entry = (type: ServiceType) =>
        matching
          .filter((service) => service.type === type)
          .map((service) => ({
            name: service.name,
            price: service.price,
            isStartingPrice: service.isStartingPrice,
            description: service.description,
          }))

      return {
        label,
        isStoreOnly: STORE_ONLY_ITEM_KINDS.includes(kind as ItemKind),
        main: entry(ServiceType.MAIN),
        addons: entry(ServiceType.ADDON),
      }
    })

    const areas = await this.area.listAreaSummaries()

    return inertia.render('home', {
      prices,
      areas: areas.map((area) => new ServiceAreaTransformer(area).toObject()),
    })
  }
}
