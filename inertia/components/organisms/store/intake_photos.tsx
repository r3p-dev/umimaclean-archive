import { useState } from 'react'
import {
  IconBolt,
  IconCamera,
  IconCameraRotate,
  IconCheck,
  IconRotate,
  IconX,
} from '@tabler/icons-react'
import { Button } from '~/components/ui/button'
import {
  CameraFeed,
  CloseCameraButton,
  PhotoPreview,
  Shutter,
} from '~/components/organisms/proof/camera_view'
import { useCamera } from '~/lib/proof/camera'
import { MAX_INTAKE_PHOTOS, type IntakeShot } from '~/lib/store/walk_in'

type Phase = 'list' | 'camera' | 'preview'

export default function IntakePhotos({
  shots,
  stamp,
  onChange,
  isDisabled = false,
}: {
  shots: IntakeShot[]
  stamp: () => string
  onChange: (shots: IntakeShot[]) => void
  isDisabled?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('list')
  const [pending, setPending] = useState<IntakeShot | null>(null)
  const camera = useCamera(phase === 'camera')

  async function shoot() {
    const photo = await camera.capture()
    if (!photo) {
      return
    }
    setPending({ photo, stamp: stamp() })
    setPhase('preview')
  }

  if (phase === 'camera') {
    return (
      <div
        data-surface="inverse"
        className="relative aspect-3/4 overflow-hidden rounded-md bg-surface-inverse"
      >
        <CameraFeed
          videoRef={camera.videoRef}
          status={camera.status}
          onRetry={camera.retry}
          frameClassName="inset-x-[9%] top-[18%] bottom-[26%]"
          guide={
            <>
              tampilan kamera belakang
              <br />
              pastikan semua barang masuk bingkai
            </>
          }
        />
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-linear-to-b from-scrim-photo to-transparent p-2">
          <CloseCameraButton onClose={() => setPhase('list')} />
          <span className="flex-1 text-center text-sm leading-[1.3] font-semibold text-surface-inverse-foreground">
            Foto barang diterima
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Lampu kilat"
            aria-pressed={camera.torch.isOn}
            isDisabled={!camera.torch.isSupported}
            onPress={camera.toggleTorch}
            className="rounded-full text-surface-inverse-foreground hover:bg-camera-control disabled:bg-transparent disabled:text-surface-inverse-muted"
          >
            <IconBolt className="size-5.5" />
          </Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1fr_auto_1fr] items-center bg-linear-to-b from-transparent to-scrim-photo px-4 pt-3.5 pb-4.5">
          <span className="text-caption leading-[1.3] font-medium text-surface-inverse-foreground">
            Foto {shots.length + 1} dari maks. {MAX_INTAKE_PHOTOS}
          </span>
          <Shutter onShoot={shoot} isDisabled={!camera.canCapture} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ganti kamera"
            onPress={camera.switchCamera}
            className="justify-self-end rounded-full bg-camera-control text-surface-inverse-foreground hover:bg-camera-control"
          >
            <IconCameraRotate className="size-5.5" />
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'preview' && pending) {
    return (
      <div className="flex flex-col gap-2.5">
        <PhotoPreview
          photo={pending.photo}
          stamp={pending.stamp}
          className="aspect-3/4 rounded-md"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" size="cta" onPress={() => setPhase('camera')}>
            <IconRotate />
            Ulangi
          </Button>
          <Button
            size="cta"
            onPress={() => {
              onChange([...shots, pending].slice(0, MAX_INTAKE_PHOTOS))
              setPending(null)
              setPhase('list')
            }}
          >
            <IconCheck />
            Pakai Foto
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ul aria-label="Foto barang" className="grid grid-cols-3 gap-2">
      {shots.map((shot, index) => (
        <li key={shot.photo} className="stripes relative aspect-square overflow-hidden rounded-md">
          <img
            src={shot.photo}
            alt={`Foto barang ${index + 1}`}
            className="absolute inset-0 size-full object-cover"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Hapus foto ${index + 1}`}
            isDisabled={isDisabled}
            onPress={() => onChange(shots.filter((item) => item !== shot))}
            className="absolute top-1 right-1 rounded-full bg-scrim text-surface-inverse-foreground hover:bg-scrim"
          >
            <IconX className="size-4.5" />
          </Button>
        </li>
      ))}
      {shots.length < MAX_INTAKE_PHOTOS && (
        <li>
          <button
            type="button"
            onClick={() => setPhase('camera')}
            disabled={isDisabled}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-input bg-card text-caption leading-[1.2] font-semibold text-info-foreground hover:bg-accent"
          >
            <IconCamera className="size-6" />
            {shots.length ? 'Foto lagi' : 'Ambil foto'}
          </button>
        </li>
      )}
    </ul>
  )
}
