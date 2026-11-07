import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/', [controllers.staff.Dashboard, 'home']).as('home')
    router.get('/jemput', [controllers.staff.Tasks, 'pickups']).as('pickups')
    router.get('/jemput/tugas', [controllers.staff.Tasks, 'pickupTask']).as('pickup_task')
    router.get('/antar', [controllers.staff.Tasks, 'deliveries']).as('deliveries')
    router.get('/antar/tugas', [controllers.staff.Tasks, 'deliveryTask']).as('delivery_task')
    router
      .group(() => {
        router.post('/mulai', [controllers.staff.Tasks, 'start']).as('start')
        router.post('/tiba', [controllers.staff.Tasks, 'arrive']).as('arrive')
        router.post('/selesai', [controllers.staff.Tasks, 'complete']).as('complete')
        router.post('/lewati', [controllers.staff.Tasks, 'skip']).as('skip')
      })
      .prefix('/:kind/:id')
      .where('kind', /^(jemput|antar)$/)
      .as('task')
    router.get('/rute', [controllers.staff.Routes, 'show']).as('route')
    router.get('/proses', [controllers.staff.Process, 'queue']).as('process')
    router.get('/proses/:id/periksa', [controllers.staff.Process, 'inspection']).as('inspection')
    router.get('/proses/:id/cuci', [controllers.staff.Process, 'washing']).as('washing')
    router
      .post('/proses/:id/periksa/mulai', [controllers.staff.Process, 'startInspection'])
      .as('inspection.start')
    router
      .post('/proses/:id/periksa', [controllers.staff.Process, 'saveInspection'])
      .as('inspection.save')
    router
      .post('/proses/:id/cuci', [controllers.staff.Process, 'completeWash'])
      .as('washing.complete')
    router.post('/proses/:id/serahkan', [controllers.staff.Process, 'collect']).as('collect')
    router.get('/lainnya', [controllers.staff.Dashboard, 'more']).as('more')
    router.get('/transaksi', [controllers.staff.Store, 'walkIn']).as('walk_in')
    router.post('/transaksi', [controllers.staff.Store, 'store']).as('walk_in.store')
    router.get('/transaksi/:id/bayar', [controllers.staff.Store, 'payment']).as('store_payment')
    router
      .post('/transaksi/:id/bayar', [controllers.staff.Store, 'recordPayment'])
      .as('store_payment.record')
    router
      .post('/transaksi/:id/qris', [controllers.staff.Store, 'startQris'])
      .as('store_payment.qris')
    router
      .post('/transaksi/:id/qris/cek', [controllers.staff.Store, 'checkQris'])
      .as('store_payment.qris_check')
    router.get('/cetak/:id/label', [controllers.staff.Prints, 'label']).as('print.label')
    router.get('/cetak/:id/struk', [controllers.staff.Prints, 'receipt']).as('print.receipt')
    router.get('/riwayat', [controllers.staff.Account, 'history']).as('history')
    router.get('/profil', [controllers.staff.Account, 'profile']).as('profile')
    router
      .put('/profil/kata-sandi', [controllers.shared.AccountSecurity, 'updatePassword'])
      .as('password.update')
    router
      .post('/profil/keluar-perangkat-lain', [controllers.shared.AccountSecurity, 'signOutOthers'])
      .as('sign_out_others')
  })
  .where('id', router.matchers.number())
  .prefix('/staf')
  .use([middleware.auth({ loginRoute: '/staf/masuk' }), middleware.area('staff')])
  .as('staff')
