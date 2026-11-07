import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.register.store': { paramsTuple?: []; params?: {} }
    'auth.password.forgot': { paramsTuple?: []; params?: {} }
    'auth.password.forgot.store': { paramsTuple?: []; params?: {} }
    'auth.password.reset': { paramsTuple?: []; params?: {} }
    'auth.password.reset.update': { paramsTuple?: []; params?: {} }
    'auth.staff_login': { paramsTuple?: []; params?: {} }
    'auth.staff_login.store': { paramsTuple?: []; params?: {} }
    'auth.otp': { paramsTuple?: []; params?: {} }
    'auth.otp.verify': { paramsTuple?: []; params?: {} }
    'auth.otp.resend': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'customer.home': { paramsTuple?: []; params?: {} }
    'customer.order.create': { paramsTuple?: []; params?: {} }
    'customer.order.review': { paramsTuple?: []; params?: {} }
    'customer.order.confirm': { paramsTuple?: []; params?: {} }
    'customer.order.store': { paramsTuple?: []; params?: {} }
    'customer.orders.index': { paramsTuple?: []; params?: {} }
    'customer.orders.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.pay': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.pay.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.pay.check': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.profile.show': { paramsTuple?: []; params?: {} }
    'customer.profile.edit': { paramsTuple?: []; params?: {} }
    'customer.profile.update': { paramsTuple?: []; params?: {} }
    'customer.password.update': { paramsTuple?: []; params?: {} }
    'customer.profile.sign_out_others': { paramsTuple?: []; params?: {} }
    'customer.phone.edit': { paramsTuple?: []; params?: {} }
    'customer.phone.store': { paramsTuple?: []; params?: {} }
    'customer.addresses.index': { paramsTuple?: []; params?: {} }
    'customer.addresses.create': { paramsTuple?: []; params?: {} }
    'customer.addresses.store': { paramsTuple?: []; params?: {} }
    'customer.addresses.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.addresses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.addresses.primary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.addresses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.old_bill': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.unlock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.home': { paramsTuple?: []; params?: {} }
    'staff.pickups': { paramsTuple?: []; params?: {} }
    'staff.pickup_task': { paramsTuple?: []; params?: {} }
    'staff.deliveries': { paramsTuple?: []; params?: {} }
    'staff.delivery_task': { paramsTuple?: []; params?: {} }
    'staff.task.start': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.arrive': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.complete': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.skip': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.route': { paramsTuple?: []; params?: {} }
    'staff.process': { paramsTuple?: []; params?: {} }
    'staff.inspection': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.washing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.inspection.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.inspection.save': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.washing.complete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.more': { paramsTuple?: []; params?: {} }
    'staff.walk_in': { paramsTuple?: []; params?: {} }
    'staff.walk_in.store': { paramsTuple?: []; params?: {} }
    'staff.store_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store_payment.record': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store_payment.qris': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store_payment.qris_check': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.label': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.history': { paramsTuple?: []; params?: {} }
    'staff.profile': { paramsTuple?: []; params?: {} }
    'staff.password.update': { paramsTuple?: []; params?: {} }
    'staff.sign_out_others': { paramsTuple?: []; params?: {} }
    'admin.summary': { paramsTuple?: []; params?: {} }
    'admin.customers': { paramsTuple?: []; params?: {} }
    'admin.activity': { paramsTuple?: []; params?: {} }
    'admin.orders': { paramsTuple?: []; params?: {} }
    'admin.orders.move': { paramsTuple?: []; params?: {} }
    'admin.orders.cancel': { paramsTuple?: []; params?: {} }
    'admin.order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.order.payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.services': { paramsTuple?: []; params?: {} }
    'admin.services.store': { paramsTuple?: []; params?: {} }
    'admin.services.toggle': { paramsTuple?: []; params?: {} }
    'admin.services.destroy': { paramsTuple?: []; params?: {} }
    'admin.services.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation': { paramsTuple?: []; params?: {} }
    'admin.reconciliation.refresh': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.refunded': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.mismatch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.recheck': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.handled': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reports': { paramsTuple?: []; params?: {} }
    'admin.costs.store': { paramsTuple?: []; params?: {} }
    'admin.costs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.costs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.staff': { paramsTuple?: []; params?: {} }
    'admin.staff.store': { paramsTuple?: []; params?: {} }
    'admin.staff.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.staff.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.staff.toggle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.store': { paramsTuple?: []; params?: {} }
    'admin.store.update': { paramsTuple?: []; params?: {} }
    'admin.areas': { paramsTuple?: []; params?: {} }
    'admin.areas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.profile': { paramsTuple?: []; params?: {} }
    'admin.password.update': { paramsTuple?: []; params?: {} }
    'admin.sign_out_others': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'legal.terms': { paramsTuple?: []; params?: {} }
    'legal.privacy': { paramsTuple?: []; params?: {} }
    'seo.sitemap': { paramsTuple?: []; params?: {} }
    'seo.robots': { paramsTuple?: []; params?: {} }
    'area.check': { paramsTuple?: []; params?: {} }
    'places.index': { paramsTuple?: []; params?: {} }
    'places.show': { paramsTuple?: []; params?: {} }
    'webhooks.midtrans': { paramsTuple?: []; params?: {} }
    'photos.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.password.forgot': { paramsTuple?: []; params?: {} }
    'auth.password.reset': { paramsTuple?: []; params?: {} }
    'auth.staff_login': { paramsTuple?: []; params?: {} }
    'auth.otp': { paramsTuple?: []; params?: {} }
    'customer.home': { paramsTuple?: []; params?: {} }
    'customer.order.create': { paramsTuple?: []; params?: {} }
    'customer.order.confirm': { paramsTuple?: []; params?: {} }
    'customer.orders.index': { paramsTuple?: []; params?: {} }
    'customer.orders.pay': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.profile.show': { paramsTuple?: []; params?: {} }
    'customer.profile.edit': { paramsTuple?: []; params?: {} }
    'customer.phone.edit': { paramsTuple?: []; params?: {} }
    'customer.addresses.index': { paramsTuple?: []; params?: {} }
    'customer.addresses.create': { paramsTuple?: []; params?: {} }
    'customer.addresses.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.old_bill': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.home': { paramsTuple?: []; params?: {} }
    'staff.pickups': { paramsTuple?: []; params?: {} }
    'staff.pickup_task': { paramsTuple?: []; params?: {} }
    'staff.deliveries': { paramsTuple?: []; params?: {} }
    'staff.delivery_task': { paramsTuple?: []; params?: {} }
    'staff.route': { paramsTuple?: []; params?: {} }
    'staff.process': { paramsTuple?: []; params?: {} }
    'staff.inspection': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.washing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.more': { paramsTuple?: []; params?: {} }
    'staff.walk_in': { paramsTuple?: []; params?: {} }
    'staff.store_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.label': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.history': { paramsTuple?: []; params?: {} }
    'staff.profile': { paramsTuple?: []; params?: {} }
    'admin.summary': { paramsTuple?: []; params?: {} }
    'admin.customers': { paramsTuple?: []; params?: {} }
    'admin.activity': { paramsTuple?: []; params?: {} }
    'admin.orders': { paramsTuple?: []; params?: {} }
    'admin.order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.services': { paramsTuple?: []; params?: {} }
    'admin.reconciliation': { paramsTuple?: []; params?: {} }
    'admin.reports': { paramsTuple?: []; params?: {} }
    'admin.staff': { paramsTuple?: []; params?: {} }
    'admin.store': { paramsTuple?: []; params?: {} }
    'admin.areas': { paramsTuple?: []; params?: {} }
    'admin.profile': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'legal.terms': { paramsTuple?: []; params?: {} }
    'legal.privacy': { paramsTuple?: []; params?: {} }
    'seo.sitemap': { paramsTuple?: []; params?: {} }
    'seo.robots': { paramsTuple?: []; params?: {} }
    'area.check': { paramsTuple?: []; params?: {} }
    'places.index': { paramsTuple?: []; params?: {} }
    'places.show': { paramsTuple?: []; params?: {} }
    'photos.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.password.forgot': { paramsTuple?: []; params?: {} }
    'auth.password.reset': { paramsTuple?: []; params?: {} }
    'auth.staff_login': { paramsTuple?: []; params?: {} }
    'auth.otp': { paramsTuple?: []; params?: {} }
    'customer.home': { paramsTuple?: []; params?: {} }
    'customer.order.create': { paramsTuple?: []; params?: {} }
    'customer.order.confirm': { paramsTuple?: []; params?: {} }
    'customer.orders.index': { paramsTuple?: []; params?: {} }
    'customer.orders.pay': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.profile.show': { paramsTuple?: []; params?: {} }
    'customer.profile.edit': { paramsTuple?: []; params?: {} }
    'customer.phone.edit': { paramsTuple?: []; params?: {} }
    'customer.addresses.index': { paramsTuple?: []; params?: {} }
    'customer.addresses.create': { paramsTuple?: []; params?: {} }
    'customer.addresses.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.old_bill': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.home': { paramsTuple?: []; params?: {} }
    'staff.pickups': { paramsTuple?: []; params?: {} }
    'staff.pickup_task': { paramsTuple?: []; params?: {} }
    'staff.deliveries': { paramsTuple?: []; params?: {} }
    'staff.delivery_task': { paramsTuple?: []; params?: {} }
    'staff.route': { paramsTuple?: []; params?: {} }
    'staff.process': { paramsTuple?: []; params?: {} }
    'staff.inspection': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.washing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.more': { paramsTuple?: []; params?: {} }
    'staff.walk_in': { paramsTuple?: []; params?: {} }
    'staff.store_payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.label': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.print.receipt': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.history': { paramsTuple?: []; params?: {} }
    'staff.profile': { paramsTuple?: []; params?: {} }
    'admin.summary': { paramsTuple?: []; params?: {} }
    'admin.customers': { paramsTuple?: []; params?: {} }
    'admin.activity': { paramsTuple?: []; params?: {} }
    'admin.orders': { paramsTuple?: []; params?: {} }
    'admin.order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.services': { paramsTuple?: []; params?: {} }
    'admin.reconciliation': { paramsTuple?: []; params?: {} }
    'admin.reports': { paramsTuple?: []; params?: {} }
    'admin.staff': { paramsTuple?: []; params?: {} }
    'admin.store': { paramsTuple?: []; params?: {} }
    'admin.areas': { paramsTuple?: []; params?: {} }
    'admin.profile': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'legal.terms': { paramsTuple?: []; params?: {} }
    'legal.privacy': { paramsTuple?: []; params?: {} }
    'seo.sitemap': { paramsTuple?: []; params?: {} }
    'seo.robots': { paramsTuple?: []; params?: {} }
    'area.check': { paramsTuple?: []; params?: {} }
    'places.index': { paramsTuple?: []; params?: {} }
    'places.show': { paramsTuple?: []; params?: {} }
    'photos.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.register.store': { paramsTuple?: []; params?: {} }
    'auth.password.forgot.store': { paramsTuple?: []; params?: {} }
    'auth.staff_login.store': { paramsTuple?: []; params?: {} }
    'auth.otp.verify': { paramsTuple?: []; params?: {} }
    'auth.otp.resend': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'customer.order.review': { paramsTuple?: []; params?: {} }
    'customer.order.store': { paramsTuple?: []; params?: {} }
    'customer.orders.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.pay.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.pay.check': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.profile.sign_out_others': { paramsTuple?: []; params?: {} }
    'customer.phone.store': { paramsTuple?: []; params?: {} }
    'customer.addresses.store': { paramsTuple?: []; params?: {} }
    'customer.addresses.primary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customer.orders.unlock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.task.start': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.arrive': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.complete': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.task.skip': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'id': ParamValue} }
    'staff.inspection.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.inspection.save': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.washing.complete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.walk_in.store': { paramsTuple?: []; params?: {} }
    'staff.store_payment.record': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store_payment.qris': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store_payment.qris_check': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.sign_out_others': { paramsTuple?: []; params?: {} }
    'admin.orders.move': { paramsTuple?: []; params?: {} }
    'admin.orders.cancel': { paramsTuple?: []; params?: {} }
    'admin.order.payment': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.services.store': { paramsTuple?: []; params?: {} }
    'admin.services.toggle': { paramsTuple?: []; params?: {} }
    'admin.services.destroy': { paramsTuple?: []; params?: {} }
    'admin.reconciliation.refresh': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.refunded': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.mismatch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.recheck': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.reconciliation.handled': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.costs.store': { paramsTuple?: []; params?: {} }
    'admin.staff.store': { paramsTuple?: []; params?: {} }
    'admin.staff.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.staff.toggle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.sign_out_others': { paramsTuple?: []; params?: {} }
    'webhooks.midtrans': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'auth.password.reset.update': { paramsTuple?: []; params?: {} }
    'customer.profile.update': { paramsTuple?: []; params?: {} }
    'customer.password.update': { paramsTuple?: []; params?: {} }
    'customer.addresses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.password.update': { paramsTuple?: []; params?: {} }
    'admin.services.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.costs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.staff.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.store.update': { paramsTuple?: []; params?: {} }
    'admin.areas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.password.update': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'customer.addresses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.costs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}