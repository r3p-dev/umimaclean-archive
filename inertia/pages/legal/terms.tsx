import LegalPage from '~/components/organisms/legal_page'
import CustomerLayout from '~/components/templates/customer_layout'

type Store = { name: string; whatsapp: string; address: string; hours: string }

export default function Terms({ store }: { store: Store }) {
  return (
    <LegalPage title="Syarat layanan" updated="21 Oktober 2026">
      <p>
        Syarat ini berlaku untuk pemesanan cuci sepatu, tas, dan helm di {store.name} (
        {store.address}
        ), baik lewat situs ini maupun langsung di toko.
      </p>
      <section className="flex flex-col gap-2">
        <h2>Pemesanan dan penjemputan</h2>
        <ul>
          <li>Penjemputan gratis hanya untuk alamat di area layanan yang tertera di situs.</li>
          <li>Helm tidak dijemput. Cuci helm hanya untuk helm yang dibawa langsung ke toko.</li>
          <li>
            Jadwal jemput dipilih per jam (slot). Slot yang sudah penuh tidak bisa dipilih. Kurir
            menghubungi lewat WhatsApp sebelum datang.
          </li>
          <li>
            Pesanan bisa dibatalkan dari halaman pesanan selama kurir belum berangkat. Setelah itu,
            hubungi kami lewat WhatsApp.
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Pemeriksaan, tagihan, dan pembayaran</h2>
        <ul>
          <li>
            Jumlah barang saat memesan adalah perkiraan. Tim kami memeriksa setiap barang, mencatat
            kondisinya, lalu menentukan layanan dan harga sesuai daftar harga yang berlaku.
          </li>
          <li>
            Tagihan dikirim lewat WhatsApp. Pencucian dimulai setelah tagihan dibayar dengan QRIS
            (online) atau di kasir toko (QRIS atau tunai).
          </li>
          <li>Kode QRIS berlaku 15 menit. Bila habis, buat kode baru dari halaman pembayaran.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Pengembalian barang</h2>
        <ul>
          <li>
            Barang diantar kembali ke alamat yang dipilih, atau diambil di toko bila Anda memilih
            begitu saat transaksi di toko.
          </li>
          <li>
            Kurir mengambil foto saat menjemput dan mengantar, dan tim kami memotret barang setelah
            dicuci, sebagai bukti kondisi barang.
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Kontak</h2>
        <p>
          Pertanyaan atau keluhan: WhatsApp {store.whatsapp}, {store.hours}.
        </p>
      </section>
    </LegalPage>
  )
}

Terms.layout = [CustomerLayout]
