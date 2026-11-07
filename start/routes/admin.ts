import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/', [controllers.admin.Dashboard, 'summary']).as('summary')
    router.get('/pelanggan', [controllers.admin.Dashboard, 'customers']).as('customers')
    router.get('/aktivitas', [controllers.admin.Dashboard, 'activityLog']).as('activity')
    router.get('/pesanan', [controllers.admin.Orders, 'index']).as('orders')
    router.post('/pesanan/status', [controllers.admin.Orders, 'move']).as('orders.move')
    router.post('/pesanan/batal', [controllers.admin.Orders, 'cancel']).as('orders.cancel')
    router.get('/pesanan/:id', [controllers.admin.Orders, 'show']).as('order')
    router
      .post('/pesanan/:id/pembayaran', [controllers.admin.Orders, 'correctPayment'])
      .as('order.payment')
    router.get('/layanan', [controllers.admin.Catalog, 'index']).as('services')
    router.post('/layanan', [controllers.admin.Catalog, 'store']).as('services.store')
    router.post('/layanan/aktif', [controllers.admin.Catalog, 'toggle']).as('services.toggle')
    router.post('/layanan/hapus', [controllers.admin.Catalog, 'destroy']).as('services.destroy')
    router
      .put('/layanan/:id', [controllers.admin.Catalog, 'update'])
      .where('id', router.matchers.number())
      .as('services.update')
    router.get('/rekonsiliasi', [controllers.admin.Reconciliation, 'index']).as('reconciliation')
    router
      .post('/rekonsiliasi/:id/cek', [controllers.admin.Reconciliation, 'refresh'])
      .where('id', router.matchers.number())
      .as('reconciliation.refresh')
    router
      .post('/rekonsiliasi/:id/dikembalikan', [controllers.admin.Reconciliation, 'refunded'])
      .as('reconciliation.refunded')
    router
      .post('/rekonsiliasi/:id/nominal', [controllers.admin.Reconciliation, 'mismatch'])
      .as('reconciliation.mismatch')
    router
      .post('/rekonsiliasi/:id/cek-ulang', [controllers.admin.Reconciliation, 'recheck'])
      .as('reconciliation.recheck')
    router
      .post('/rekonsiliasi/:id/ditangani', [controllers.admin.Reconciliation, 'handled'])
      .as('reconciliation.handled')
    router.get('/laporan', [controllers.admin.Dashboard, 'reportsPage']).as('reports')
    router.post('/laporan/biaya', [controllers.admin.Dashboard, 'storeCost']).as('costs.store')
    router
      .put('/laporan/biaya/:id', [controllers.admin.Dashboard, 'updateCost'])
      .where('id', router.matchers.number())
      .as('costs.update')
    router
      .delete('/laporan/biaya/:id', [controllers.admin.Dashboard, 'destroyCost'])
      .where('id', router.matchers.number())
      .as('costs.destroy')
    router.get('/pengaturan', [controllers.admin.Settings, 'staff']).as('staff')
    router.post('/pengaturan', [controllers.admin.Settings, 'storeStaff']).as('staff.store')
    router
      .put('/pengaturan/:id', [controllers.admin.Settings, 'updateStaff'])
      .where('id', router.matchers.number())
      .as('staff.update')
    router
      .post('/pengaturan/:id/reset', [controllers.admin.Settings, 'resetStaff'])
      .where('id', router.matchers.number())
      .as('staff.reset')
    router
      .post('/pengaturan/:id/aktif', [controllers.admin.Settings, 'toggleStaff'])
      .where('id', router.matchers.number())
      .as('staff.toggle')
    router.get('/pengaturan/toko', [controllers.admin.Settings, 'store']).as('store')
    router.put('/pengaturan/toko', [controllers.admin.Settings, 'saveStore']).as('store.update')
    router.get('/pengaturan/area', [controllers.admin.Settings, 'areas']).as('areas')
    router
      .put('/pengaturan/area/:id', [controllers.admin.Settings, 'toggleArea'])
      .where('id', router.matchers.number())
      .as('areas.update')
    router.get('/profil', [controllers.admin.Profile, 'show']).as('profile')
    router
      .put('/profil/kata-sandi', [controllers.shared.AccountSecurity, 'updatePassword'])
      .as('password.update')
    router
      .post('/profil/keluar-perangkat-lain', [controllers.shared.AccountSecurity, 'signOutOthers'])
      .as('sign_out_others')
  })
  .where('id', router.matchers.number())
  .prefix('/admin')
  .use([middleware.auth({ loginRoute: '/staf/masuk' }), middleware.area('admin')])
  .as('admin')
