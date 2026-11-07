import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/beranda', [controllers.customer.Home, 'show']).as('home')

    router.get('/pesan', [controllers.customer.Checkout, 'create']).as('order.create')
    router.post('/pesan/tinjau', [controllers.customer.Checkout, 'review']).as('order.review')
    router.get('/pesan/konfirmasi', [controllers.customer.Checkout, 'confirm']).as('order.confirm')
    router.post('/pesan', [controllers.customer.Checkout, 'store']).as('order.store')

    router.get('/pesanan', [controllers.customer.Orders, 'index']).as('orders.index')
    router.post('/pesanan/:id/batal', [controllers.customer.Orders, 'cancel']).as('orders.cancel')
    router.get('/pesanan/:id/bayar', [controllers.customer.Orders, 'pay']).as('orders.pay')
    router
      .post('/pesanan/:id/bayar', [controllers.customer.Orders, 'startPayment'])
      .as('orders.pay.start')
    router
      .post('/pesanan/:id/bayar/cek', [controllers.customer.Orders, 'checkPayment'])
      .as('orders.pay.check')

    router.get('/profil', [controllers.customer.Profile, 'show']).as('profile.show')
    router.get('/profil/ubah', [controllers.customer.Profile, 'edit']).as('profile.edit')
    router.put('/profil', [controllers.customer.Profile, 'update']).as('profile.update')

    router
      .put('/profil/kata-sandi', [controllers.shared.AccountSecurity, 'updatePassword'])
      .as('password.update')
    router
      .post('/profil/keluar-perangkat-lain', [controllers.shared.AccountSecurity, 'signOutOthers'])
      .as('profile.sign_out_others')

    router.get('/profil/nomor', [controllers.customer.Phone, 'edit']).as('phone.edit')
    router.post('/profil/nomor', [controllers.customer.Phone, 'store']).as('phone.store')

    router.get('/profil/alamat', [controllers.customer.Addresses, 'index']).as('addresses.index')
    router
      .get('/profil/alamat/baru', [controllers.customer.Addresses, 'create'])
      .as('addresses.create')
    router.post('/profil/alamat', [controllers.customer.Addresses, 'store']).as('addresses.store')
    router
      .get('/profil/alamat/:id/ubah', [controllers.customer.Addresses, 'edit'])
      .as('addresses.edit')
    router
      .put('/profil/alamat/:id', [controllers.customer.Addresses, 'update'])
      .as('addresses.update')
    router
      .post('/profil/alamat/:id/utama', [controllers.customer.Addresses, 'makePrimary'])
      .as('addresses.primary')
    router
      .delete('/profil/alamat/:id', [controllers.customer.Addresses, 'destroy'])
      .as('addresses.destroy')
  })
  .where('id', router.matchers.number())
  .use([middleware.auth(), middleware.area('customer')])
  .as('customer')

router
  .group(() => {
    router.get('/pesanan/:id', [controllers.customer.Orders, 'show']).as('orders.show')
    router
      .get('/pesanan/:id/tagihan', [controllers.customer.Orders, 'oldBill'])
      .as('orders.old_bill')
    router.get('/pesanan/:id/struk', [controllers.customer.Orders, 'receipt']).as('orders.receipt')
    router.post('/pesanan/:id/buka', [controllers.customer.Orders, 'unlock']).as('orders.unlock')
  })
  .where('id', router.matchers.number())
  .as('customer')
