import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'admin/activity': ExtractProps<(typeof import('../../inertia/pages/admin/activity.tsx'))['default']>
    'admin/customers': ExtractProps<(typeof import('../../inertia/pages/admin/customers.tsx'))['default']>
    'admin/orders/detail': ExtractProps<(typeof import('../../inertia/pages/admin/orders/detail.tsx'))['default']>
    'admin/orders/list': ExtractProps<(typeof import('../../inertia/pages/admin/orders/list.tsx'))['default']>
    'admin/profile': ExtractProps<(typeof import('../../inertia/pages/admin/profile.tsx'))['default']>
    'admin/reconciliation': ExtractProps<(typeof import('../../inertia/pages/admin/reconciliation.tsx'))['default']>
    'admin/reports': ExtractProps<(typeof import('../../inertia/pages/admin/reports.tsx'))['default']>
    'admin/services': ExtractProps<(typeof import('../../inertia/pages/admin/services.tsx'))['default']>
    'admin/settings/areas': ExtractProps<(typeof import('../../inertia/pages/admin/settings/areas.tsx'))['default']>
    'admin/settings/staff': ExtractProps<(typeof import('../../inertia/pages/admin/settings/staff.tsx'))['default']>
    'admin/settings/store': ExtractProps<(typeof import('../../inertia/pages/admin/settings/store.tsx'))['default']>
    'admin/summary': ExtractProps<(typeof import('../../inertia/pages/admin/summary.tsx'))['default']>
    'auth/forgot_password': ExtractProps<(typeof import('../../inertia/pages/auth/forgot_password.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/otp': ExtractProps<(typeof import('../../inertia/pages/auth/otp.tsx'))['default']>
    'auth/register': ExtractProps<(typeof import('../../inertia/pages/auth/register.tsx'))['default']>
    'auth/reset_password': ExtractProps<(typeof import('../../inertia/pages/auth/reset_password.tsx'))['default']>
    'auth/staff_login': ExtractProps<(typeof import('../../inertia/pages/auth/staff_login.tsx'))['default']>
    'customer/addresses/form': ExtractProps<(typeof import('../../inertia/pages/customer/addresses/form.tsx'))['default']>
    'customer/addresses/index': ExtractProps<(typeof import('../../inertia/pages/customer/addresses/index.tsx'))['default']>
    'customer/home/index': ExtractProps<(typeof import('../../inertia/pages/customer/home/index.tsx'))['default']>
    'customer/home/welcome': ExtractProps<(typeof import('../../inertia/pages/customer/home/welcome.tsx'))['default']>
    'customer/order/confirm': ExtractProps<(typeof import('../../inertia/pages/customer/order/confirm.tsx'))['default']>
    'customer/order/create': ExtractProps<(typeof import('../../inertia/pages/customer/order/create.tsx'))['default']>
    'customer/orders/index': ExtractProps<(typeof import('../../inertia/pages/customer/orders/index.tsx'))['default']>
    'customer/orders/receipt': ExtractProps<(typeof import('../../inertia/pages/customer/orders/receipt.tsx'))['default']>
    'customer/orders/show': ExtractProps<(typeof import('../../inertia/pages/customer/orders/show.tsx'))['default']>
    'customer/orders/unlock': ExtractProps<(typeof import('../../inertia/pages/customer/orders/unlock.tsx'))['default']>
    'customer/payment/qris': ExtractProps<(typeof import('../../inertia/pages/customer/payment/qris.tsx'))['default']>
    'customer/profile/edit': ExtractProps<(typeof import('../../inertia/pages/customer/profile/edit.tsx'))['default']>
    'customer/profile/phone': ExtractProps<(typeof import('../../inertia/pages/customer/profile/phone.tsx'))['default']>
    'customer/profile/show': ExtractProps<(typeof import('../../inertia/pages/customer/profile/show.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.tsx'))['default']>
    'legal/privacy': ExtractProps<(typeof import('../../inertia/pages/legal/privacy.tsx'))['default']>
    'legal/terms': ExtractProps<(typeof import('../../inertia/pages/legal/terms.tsx'))['default']>
    'staff/account/history': ExtractProps<(typeof import('../../inertia/pages/staff/account/history.tsx'))['default']>
    'staff/account/profile': ExtractProps<(typeof import('../../inertia/pages/staff/account/profile.tsx'))['default']>
    'staff/home': ExtractProps<(typeof import('../../inertia/pages/staff/home.tsx'))['default']>
    'staff/more': ExtractProps<(typeof import('../../inertia/pages/staff/more.tsx'))['default']>
    'staff/print/label': ExtractProps<(typeof import('../../inertia/pages/staff/print/label.tsx'))['default']>
    'staff/print/receipt': ExtractProps<(typeof import('../../inertia/pages/staff/print/receipt.tsx'))['default']>
    'staff/process/inspection': ExtractProps<(typeof import('../../inertia/pages/staff/process/inspection.tsx'))['default']>
    'staff/process/queue': ExtractProps<(typeof import('../../inertia/pages/staff/process/queue.tsx'))['default']>
    'staff/process/washing': ExtractProps<(typeof import('../../inertia/pages/staff/process/washing.tsx'))['default']>
    'staff/store/payment': ExtractProps<(typeof import('../../inertia/pages/staff/store/payment.tsx'))['default']>
    'staff/store/walk_in': ExtractProps<(typeof import('../../inertia/pages/staff/store/walk_in.tsx'))['default']>
    'staff/tasks/active': ExtractProps<(typeof import('../../inertia/pages/staff/tasks/active.tsx'))['default']>
    'staff/tasks/queue': ExtractProps<(typeof import('../../inertia/pages/staff/tasks/queue.tsx'))['default']>
  }
}
