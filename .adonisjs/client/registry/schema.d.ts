/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.login': {
    methods: ["GET","HEAD"]
    pattern: '/masuk'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['create']>>>
    }
  }
  'auth.login.store': {
    methods: ["POST"]
    pattern: '/masuk'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/session').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/session').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.register': {
    methods: ["GET","HEAD"]
    pattern: '/daftar'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/register_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/register_controller').default['create']>>>
    }
  }
  'auth.register.store': {
    methods: ["POST"]
    pattern: '/daftar'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/register').registerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/register').registerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/register_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/register_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.password.forgot': {
    methods: ["GET","HEAD"]
    pattern: '/lupa-kata-sandi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['create']>>>
    }
  }
  'auth.password.forgot.store': {
    methods: ["POST"]
    pattern: '/lupa-kata-sandi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/password').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/password').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.password.reset': {
    methods: ["GET","HEAD"]
    pattern: '/kata-sandi-baru'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['edit']>>>
    }
  }
  'auth.password.reset.update': {
    methods: ["PUT"]
    pattern: '/kata-sandi-baru'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/password').resetPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/password').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.staff_login': {
    methods: ["GET","HEAD"]
    pattern: '/staf/masuk'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/staff_session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/staff_session_controller').default['create']>>>
    }
  }
  'auth.staff_login.store': {
    methods: ["POST"]
    pattern: '/staf/masuk'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/session').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/session').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/staff_session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/staff_session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.otp': {
    methods: ["GET","HEAD"]
    pattern: '/verifikasi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['show']>>>
    }
  }
  'auth.otp.verify': {
    methods: ["POST"]
    pattern: '/verifikasi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth/otp').verifyOtpValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth/otp').verifyOtpValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['verify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.otp.resend': {
    methods: ["POST"]
    pattern: '/verifikasi/kirim-ulang'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/otp_controller').default['resend']>>>
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/keluar'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/session_controller').default['destroy']>>>
    }
  }
  'customer.home': {
    methods: ["GET","HEAD"]
    pattern: '/beranda'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/home_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/home_controller').default['show']>>>
    }
  }
  'customer.order.create': {
    methods: ["GET","HEAD"]
    pattern: '/pesan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['create']>>>
    }
  }
  'customer.order.review': {
    methods: ["POST"]
    pattern: '/pesan/tinjau'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/order').createOrderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/order').createOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['review']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['review']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.order.confirm': {
    methods: ["GET","HEAD"]
    pattern: '/pesan/konfirmasi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['confirm']>>>
    }
  }
  'customer.order.store': {
    methods: ["POST"]
    pattern: '/pesan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/order').createOrderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/order').createOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/checkout_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/pesanan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['index']>>>
    }
  }
  'customer.orders.cancel': {
    methods: ["POST"]
    pattern: '/pesanan/:id/batal'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/cancel').cancelOrderValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/cancel').cancelOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['cancel']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.orders.pay': {
    methods: ["GET","HEAD"]
    pattern: '/pesanan/:id/bayar'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['pay']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['pay']>>>
    }
  }
  'customer.orders.pay.start': {
    methods: ["POST"]
    pattern: '/pesanan/:id/bayar'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['startPayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['startPayment']>>>
    }
  }
  'customer.orders.pay.check': {
    methods: ["POST"]
    pattern: '/pesanan/:id/bayar/cek'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['checkPayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['checkPayment']>>>
    }
  }
  'customer.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/profil'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['show']>>>
    }
  }
  'customer.profile.edit': {
    methods: ["GET","HEAD"]
    pattern: '/profil/ubah'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['edit']>>>
    }
  }
  'customer.profile.update': {
    methods: ["PUT"]
    pattern: '/profil'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/profile').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/profile').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.password.update': {
    methods: ["PUT"]
    pattern: '/profil/kata-sandi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.profile.sign_out_others': {
    methods: ["POST"]
    pattern: '/profil/keluar-perangkat-lain'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
    }
  }
  'customer.phone.edit': {
    methods: ["GET","HEAD"]
    pattern: '/profil/nomor'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/phone_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/phone_controller').default['edit']>>>
    }
  }
  'customer.phone.store': {
    methods: ["POST"]
    pattern: '/profil/nomor'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/profile').changePhoneValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/profile').changePhoneValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/phone_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/phone_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.addresses.index': {
    methods: ["GET","HEAD"]
    pattern: '/profil/alamat'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['index']>>>
    }
  }
  'customer.addresses.create': {
    methods: ["GET","HEAD"]
    pattern: '/profil/alamat/baru'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['create']>>>
    }
  }
  'customer.addresses.store': {
    methods: ["POST"]
    pattern: '/profil/alamat'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/address').saveAddressValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/address').saveAddressValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.addresses.edit': {
    methods: ["GET","HEAD"]
    pattern: '/profil/alamat/:id/ubah'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['edit']>>>
    }
  }
  'customer.addresses.update': {
    methods: ["PUT"]
    pattern: '/profil/alamat/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/address').saveAddressValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/address').saveAddressValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer.addresses.primary': {
    methods: ["POST"]
    pattern: '/profil/alamat/:id/utama'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['makePrimary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['makePrimary']>>>
    }
  }
  'customer.addresses.destroy': {
    methods: ["DELETE"]
    pattern: '/profil/alamat/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/addresses_controller').default['destroy']>>>
    }
  }
  'customer.orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/pesanan/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['show']>>>
    }
  }
  'customer.orders.old_bill': {
    methods: ["GET","HEAD"]
    pattern: '/pesanan/:id/tagihan'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['oldBill']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['oldBill']>>>
    }
  }
  'customer.orders.receipt': {
    methods: ["GET","HEAD"]
    pattern: '/pesanan/:id/struk'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['receipt']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['receipt']>>>
    }
  }
  'customer.orders.unlock': {
    methods: ["POST"]
    pattern: '/pesanan/:id/buka'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/customer/tracking').unlockTrackingValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/customer/tracking').unlockTrackingValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['unlock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer/orders_controller').default['unlock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.home': {
    methods: ["GET","HEAD"]
    pattern: '/staf'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/dashboard_controller').default['home']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/dashboard_controller').default['home']>>>
    }
  }
  'staff.pickups': {
    methods: ["GET","HEAD"]
    pattern: '/staf/jemput'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['pickups']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['pickups']>>>
    }
  }
  'staff.pickup_task': {
    methods: ["GET","HEAD"]
    pattern: '/staf/jemput/tugas'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['pickupTask']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['pickupTask']>>>
    }
  }
  'staff.deliveries': {
    methods: ["GET","HEAD"]
    pattern: '/staf/antar'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['deliveries']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['deliveries']>>>
    }
  }
  'staff.delivery_task': {
    methods: ["GET","HEAD"]
    pattern: '/staf/antar/tugas'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['deliveryTask']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['deliveryTask']>>>
    }
  }
  'staff.task.start': {
    methods: ["POST"]
    pattern: '/staf/:kind/:id/mulai'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { kind: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['start']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['start']>>>
    }
  }
  'staff.task.arrive': {
    methods: ["POST"]
    pattern: '/staf/:kind/:id/tiba'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { kind: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['arrive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['arrive']>>>
    }
  }
  'staff.task.complete': {
    methods: ["POST"]
    pattern: '/staf/:kind/:id/selesai'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/task').completeTaskValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { kind: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/task').completeTaskValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['complete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['complete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.task.skip': {
    methods: ["POST"]
    pattern: '/staf/:kind/:id/lewati'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/task').skipTaskValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { kind: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/task').skipTaskValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['skip']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/tasks_controller').default['skip']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.route': {
    methods: ["GET","HEAD"]
    pattern: '/staf/rute'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/staff/task').findRouteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/routes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/routes_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.process': {
    methods: ["GET","HEAD"]
    pattern: '/staf/proses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['queue']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['queue']>>>
    }
  }
  'staff.inspection': {
    methods: ["GET","HEAD"]
    pattern: '/staf/proses/:id/periksa'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['inspection']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['inspection']>>>
    }
  }
  'staff.washing': {
    methods: ["GET","HEAD"]
    pattern: '/staf/proses/:id/cuci'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['washing']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['washing']>>>
    }
  }
  'staff.inspection.start': {
    methods: ["POST"]
    pattern: '/staf/proses/:id/periksa/mulai'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['startInspection']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['startInspection']>>>
    }
  }
  'staff.inspection.save': {
    methods: ["POST"]
    pattern: '/staf/proses/:id/periksa'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/process').saveInspectionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/process').saveInspectionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['saveInspection']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['saveInspection']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.washing.complete': {
    methods: ["POST"]
    pattern: '/staf/proses/:id/cuci'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/process').washValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/process').washValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['completeWash']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['completeWash']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.collect': {
    methods: ["POST"]
    pattern: '/staf/proses/:id/serahkan'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['collect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/process_controller').default['collect']>>>
    }
  }
  'staff.more': {
    methods: ["GET","HEAD"]
    pattern: '/staf/lainnya'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/dashboard_controller').default['more']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/dashboard_controller').default['more']>>>
    }
  }
  'staff.walk_in': {
    methods: ["GET","HEAD"]
    pattern: '/staf/transaksi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['walkIn']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['walkIn']>>>
    }
  }
  'staff.walk_in.store': {
    methods: ["POST"]
    pattern: '/staf/transaksi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/store').walkInValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/store').walkInValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.store_payment': {
    methods: ["GET","HEAD"]
    pattern: '/staf/transaksi/:id/bayar'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['payment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['payment']>>>
    }
  }
  'staff.store_payment.record': {
    methods: ["POST"]
    pattern: '/staf/transaksi/:id/bayar'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/staff/store').counterPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/staff/store').counterPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['recordPayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['recordPayment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.store_payment.qris': {
    methods: ["POST"]
    pattern: '/staf/transaksi/:id/qris'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['startQris']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['startQris']>>>
    }
  }
  'staff.store_payment.qris_check': {
    methods: ["POST"]
    pattern: '/staf/transaksi/:id/qris/cek'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['checkQris']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/store_controller').default['checkQris']>>>
    }
  }
  'staff.print.label': {
    methods: ["GET","HEAD"]
    pattern: '/staf/cetak/:id/label'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/prints_controller').default['label']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/prints_controller').default['label']>>>
    }
  }
  'staff.print.receipt': {
    methods: ["GET","HEAD"]
    pattern: '/staf/cetak/:id/struk'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/prints_controller').default['receipt']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/prints_controller').default['receipt']>>>
    }
  }
  'staff.history': {
    methods: ["GET","HEAD"]
    pattern: '/staf/riwayat'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/account_controller').default['history']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/account_controller').default['history']>>>
    }
  }
  'staff.profile': {
    methods: ["GET","HEAD"]
    pattern: '/staf/profil'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/staff/account_controller').default['profile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/staff/account_controller').default['profile']>>>
    }
  }
  'staff.password.update': {
    methods: ["PUT"]
    pattern: '/staf/profil/kata-sandi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'staff.sign_out_others': {
    methods: ["POST"]
    pattern: '/staf/profil/keluar-perangkat-lain'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
    }
  }
  'admin.summary': {
    methods: ["GET","HEAD"]
    pattern: '/admin'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['summary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['summary']>>>
    }
  }
  'admin.customers': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pelanggan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['customers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['customers']>>>
    }
  }
  'admin.activity': {
    methods: ["GET","HEAD"]
    pattern: '/admin/aktivitas'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['activityLog']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['activityLog']>>>
    }
  }
  'admin.orders': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pesanan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['index']>>>
    }
  }
  'admin.orders.move': {
    methods: ["POST"]
    pattern: '/admin/pesanan/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/order').moveOrdersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/order').moveOrdersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['move']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['move']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.orders.cancel': {
    methods: ["POST"]
    pattern: '/admin/pesanan/batal'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/order').cancelOrdersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/order').cancelOrdersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['cancel']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.order': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pesanan/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['show']>>>
    }
  }
  'admin.order.payment': {
    methods: ["POST"]
    pattern: '/admin/pesanan/:id/pembayaran'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/order').correctPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/order').correctPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['correctPayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/orders_controller').default['correctPayment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.services': {
    methods: ["GET","HEAD"]
    pattern: '/admin/layanan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['index']>>>
    }
  }
  'admin.services.store': {
    methods: ["POST"]
    pattern: '/admin/layanan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/service').saveServiceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/service').saveServiceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.services.toggle': {
    methods: ["POST"]
    pattern: '/admin/layanan/aktif'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/service').toggleServicesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/service').toggleServicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['toggle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['toggle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.services.destroy': {
    methods: ["POST"]
    pattern: '/admin/layanan/hapus'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/service').deleteServicesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/service').deleteServicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.services.update': {
    methods: ["PUT"]
    pattern: '/admin/layanan/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/service').saveServiceValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/service').saveServiceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/catalog_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.reconciliation': {
    methods: ["GET","HEAD"]
    pattern: '/admin/rekonsiliasi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['index']>>>
    }
  }
  'admin.reconciliation.refresh': {
    methods: ["POST"]
    pattern: '/admin/rekonsiliasi/:id/cek'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['refresh']>>>
    }
  }
  'admin.reconciliation.refunded': {
    methods: ["POST"]
    pattern: '/admin/rekonsiliasi/:id/dikembalikan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/reconciliation').reviewPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/reconciliation').reviewPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['refunded']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['refunded']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.reconciliation.mismatch': {
    methods: ["POST"]
    pattern: '/admin/rekonsiliasi/:id/nominal'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/reconciliation').resolveMismatchValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/reconciliation').resolveMismatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['mismatch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['mismatch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.reconciliation.recheck': {
    methods: ["POST"]
    pattern: '/admin/rekonsiliasi/:id/cek-ulang'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['recheck']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['recheck']>>>
    }
  }
  'admin.reconciliation.handled': {
    methods: ["POST"]
    pattern: '/admin/rekonsiliasi/:id/ditangani'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/reconciliation').reviewPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/reconciliation').reviewPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['handled']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/reconciliation_controller').default['handled']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.reports': {
    methods: ["GET","HEAD"]
    pattern: '/admin/laporan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['reportsPage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['reportsPage']>>>
    }
  }
  'admin.costs.store': {
    methods: ["POST"]
    pattern: '/admin/laporan/biaya'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/cost').saveCostValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/cost').saveCostValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['storeCost']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['storeCost']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.costs.update': {
    methods: ["PUT"]
    pattern: '/admin/laporan/biaya/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/cost').saveCostValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/cost').saveCostValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['updateCost']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['updateCost']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.costs.destroy': {
    methods: ["DELETE"]
    pattern: '/admin/laporan/biaya/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['destroyCost']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['destroyCost']>>>
    }
  }
  'admin.staff': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pengaturan'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['staff']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['staff']>>>
    }
  }
  'admin.staff.store': {
    methods: ["POST"]
    pattern: '/admin/pengaturan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/staff').saveStaffValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/staff').saveStaffValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['storeStaff']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['storeStaff']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.staff.update': {
    methods: ["PUT"]
    pattern: '/admin/pengaturan/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/staff').saveStaffValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/staff').saveStaffValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['updateStaff']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['updateStaff']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.staff.reset': {
    methods: ["POST"]
    pattern: '/admin/pengaturan/:id/reset'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['resetStaff']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['resetStaff']>>>
    }
  }
  'admin.staff.toggle': {
    methods: ["POST"]
    pattern: '/admin/pengaturan/:id/aktif'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/staff').staffActiveValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/staff').staffActiveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['toggleStaff']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['toggleStaff']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.store': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pengaturan/toko'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['store']>>>
    }
  }
  'admin.store.update': {
    methods: ["PUT"]
    pattern: '/admin/pengaturan/toko'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/settings').saveStoreSettingsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/settings').saveStoreSettingsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['saveStore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['saveStore']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.areas': {
    methods: ["GET","HEAD"]
    pattern: '/admin/pengaturan/area'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin/settings').searchAreasValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['areas']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['areas']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.areas.update': {
    methods: ["PUT"]
    pattern: '/admin/pengaturan/area/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/settings').toggleAreaValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/settings').toggleAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['toggleArea']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/settings_controller').default['toggleArea']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.profile': {
    methods: ["GET","HEAD"]
    pattern: '/admin/profil'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/profile_controller').default['show']>>>
    }
  }
  'admin.password.update': {
    methods: ["PUT"]
    pattern: '/admin/profil/kata-sandi'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shared/account').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.sign_out_others': {
    methods: ["POST"]
    pattern: '/admin/profil/keluar-perangkat-lain'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/account_security_controller').default['signOutOthers']>>>
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/home_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/home_controller').default['show']>>>
    }
  }
  'legal.terms': {
    methods: ["GET","HEAD"]
    pattern: '/syarat'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legal_controller').default['terms']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legal_controller').default['terms']>>>
    }
  }
  'legal.privacy': {
    methods: ["GET","HEAD"]
    pattern: '/privasi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legal_controller').default['privacy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legal_controller').default['privacy']>>>
    }
  }
  'seo.sitemap': {
    methods: ["GET","HEAD"]
    pattern: '/sitemap.xml'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seo_controller').default['sitemap']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seo_controller').default['sitemap']>>>
    }
  }
  'seo.robots': {
    methods: ["GET","HEAD"]
    pattern: '/robots.txt'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seo_controller').default['robots']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seo_controller').default['robots']>>>
    }
  }
  'area.check': {
    methods: ["GET","HEAD"]
    pattern: '/area'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/shared/area').checkAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/areas_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/areas_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'places.index': {
    methods: ["GET","HEAD"]
    pattern: '/lokasi'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/shared/place').searchPlacesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/places_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/places_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'places.show': {
    methods: ["GET","HEAD"]
    pattern: '/lokasi/titik'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/shared/area').checkAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/places_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/places_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'webhooks.midtrans': {
    methods: ["POST"]
    pattern: '/webhooks/midtrans'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/payment_notifications_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/payment_notifications_controller').default['store']>>>
    }
  }
  'photos.show': {
    methods: ["GET","HEAD"]
    pattern: '/foto-bukti/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shared/proof_photos_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shared/proof_photos_controller').default['show']>>>
    }
  }
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
