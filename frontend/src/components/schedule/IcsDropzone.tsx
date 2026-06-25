import { useDropzone } from 'react-dropzone'
import { useImportIcs } from '../../hooks/useSchedule'

interface IcsDropzoneProps {
  onSuccess?: (firstDate: Date) => void
}

export default function IcsDropzone({ onSuccess }: IcsDropzoneProps) {
  const importMutation = useImportIcs()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/calendar': ['.ics'] },
    multiple: false,
    onDrop: (files) => {
      if (!files[0]) return
      importMutation.mutate(files[0], {
        onSuccess: (data) => {
          if (onSuccess && data.length > 0) {
            onSuccess(new Date(data[0].periode_debut))
          }
        },
      })
    },
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-sm text-gray-500">
        {importMutation.isPending
          ? 'Import en cours…'
          : isDragActive
          ? 'Déposez le fichier .ics ici'
          : 'Glissez un fichier .ics ici, ou cliquez pour sélectionner'}
      </p>
      {importMutation.isSuccess && (
        <p className="text-xs text-green-600 mt-2">Import terminé — navigation vers le début de l'emploi du temps…</p>
      )}
    </div>
  )
}
