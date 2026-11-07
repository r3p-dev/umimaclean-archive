/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    login: typeof routes['auth.login'] & {
      store: typeof routes['auth.login.store']
    }
    register: typeof routes['auth.register'] & {
      store: typeof routes['auth.register.store']
    }
    password: {
      forgot: typeof routes['auth.password.forgot'] & {
        store: typeof routes['auth.password.forgot.store']
      }
      reset: typeof routes['auth.password.reset'] & {
        update: typeof routes['auth.password.reset.update']
      }
    }
    staffLogin: typeof routes['auth.staff_login'] & {
      store: typeof routes['auth.staff_login.store']
    }
    otp: typeof routes['auth.otp'] & {
      verify: typeof routes['auth.otp.verify']
      resend: typeof routes['auth.otp.resend']
    }
    logout: typeof routes['auth.logout']
  }
  customer: {
    home: typeof routes['customer.home']
    order: {
      create: typeof routes['customer.order.create']
      review: typeof routes['customer.order.review']
      confirm: typeof routes['customer.order.confirm']
      store: typeof routes['customer.order.store']
    }
    orders: {
      index: typeof routes['customer.orders.index']
      cancel: typeof routes['customer.orders.cancel']
      pay: typeof routes['customer.orders.pay'] & {
        start: typeof routes['customer.orders.pay.start']
        check: typeof routes['customer.orders.pay.check']
      }
      show: typeof routes['customer.orders.show']
      oldBill: typeof routes['customer.orders.old_bill']
      receipt: typeof routes['customer.orders.receipt']
      unlock: typeof routes['customer.orders.unlock']
    }
    profile: {
      show: typeof routes['customer.profile.show']
      edit: typeof routes['customer.profile.edit']
      update: typeof routes['customer.profile.update']
      signOutOthers: typeof routes['customer.profile.sign_out_others']
    }
    password: {
      update: typeof routes['customer.password.update']
    }
    phone: {
      edit: typeof routes['customer.phone.edit']
      store: typeof routes['customer.phone.store']
    }
    addresses: {
      index: typeof routes['customer.addresses.index']
      create: typeof routes['customer.addresses.create']
      store: typeof routes['customer.addresses.store']
      edit: typeof routes['customer.addresses.edit']
      update: typeof routes['customer.addresses.update']
      primary: typeof routes['customer.addresses.primary']
      destroy: typeof routes['customer.addresses.destroy']
    }
  }
  staff: {
    home: typeof routes['staff.home']
    pickups: typeof routes['staff.pickups']
    pickupTask: typeof routes['staff.pickup_task']
    deliveries: typeof routes['staff.deliveries']
    deliveryTask: typeof routes['staff.delivery_task']
    task: {
      start: typeof routes['staff.task.start']
      arrive: typeof routes['staff.task.arrive']
      complete: typeof routes['staff.task.complete']
      skip: typeof routes['staff.task.skip']
    }
    route: typeof routes['staff.route']
    process: typeof routes['staff.process']
    inspection: typeof routes['staff.inspection'] & {
      start: typeof routes['staff.inspection.start']
      save: typeof routes['staff.inspection.save']
    }
    washing: typeof routes['staff.washing'] & {
      complete: typeof routes['staff.washing.complete']
    }
    collect: typeof routes['staff.collect']
    more: typeof routes['staff.more']
    walkIn: typeof routes['staff.walk_in'] & {
      store: typeof routes['staff.walk_in.store']
    }
    storePayment: typeof routes['staff.store_payment'] & {
      record: typeof routes['staff.store_payment.record']
      qris: typeof routes['staff.store_payment.qris']
      qrisCheck: typeof routes['staff.store_payment.qris_check']
    }
    print: {
      label: typeof routes['staff.print.label']
      receipt: typeof routes['staff.print.receipt']
    }
    history: typeof routes['staff.history']
    profile: typeof routes['staff.profile']
    password: {
      update: typeof routes['staff.password.update']
    }
    signOutOthers: typeof routes['staff.sign_out_others']
  }
  admin: {
    summary: typeof routes['admin.summary']
    customers: typeof routes['admin.customers']
    activity: typeof routes['admin.activity']
    orders: typeof routes['admin.orders'] & {
      move: typeof routes['admin.orders.move']
      cancel: typeof routes['admin.orders.cancel']
    }
    order: typeof routes['admin.order'] & {
      payment: typeof routes['admin.order.payment']
    }
    services: typeof routes['admin.services'] & {
      store: typeof routes['admin.services.store']
      toggle: typeof routes['admin.services.toggle']
      destroy: typeof routes['admin.services.destroy']
      update: typeof routes['admin.services.update']
    }
    reconciliation: typeof routes['admin.reconciliation'] & {
      refresh: typeof routes['admin.reconciliation.refresh']
      refunded: typeof routes['admin.reconciliation.refunded']
      mismatch: typeof routes['admin.reconciliation.mismatch']
      recheck: typeof routes['admin.reconciliation.recheck']
      handled: typeof routes['admin.reconciliation.handled']
    }
    reports: typeof routes['admin.reports']
    costs: {
      store: typeof routes['admin.costs.store']
      update: typeof routes['admin.costs.update']
      destroy: typeof routes['admin.costs.destroy']
    }
    staff: typeof routes['admin.staff'] & {
      store: typeof routes['admin.staff.store']
      update: typeof routes['admin.staff.update']
      reset: typeof routes['admin.staff.reset']
      toggle: typeof routes['admin.staff.toggle']
    }
    store: typeof routes['admin.store'] & {
      update: typeof routes['admin.store.update']
    }
    areas: typeof routes['admin.areas'] & {
      update: typeof routes['admin.areas.update']
    }
    profile: typeof routes['admin.profile']
    password: {
      update: typeof routes['admin.password.update']
    }
    signOutOthers: typeof routes['admin.sign_out_others']
  }
  home: typeof routes['home']
  legal: {
    terms: typeof routes['legal.terms']
    privacy: typeof routes['legal.privacy']
  }
  seo: {
    sitemap: typeof routes['seo.sitemap']
    robots: typeof routes['seo.robots']
  }
  area: {
    check: typeof routes['area.check']
  }
  places: {
    index: typeof routes['places.index']
    show: typeof routes['places.show']
  }
  webhooks: {
    midtrans: typeof routes['webhooks.midtrans']
  }
  photos: {
    show: typeof routes['photos.show']
  }
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
}
