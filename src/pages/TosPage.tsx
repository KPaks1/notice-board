import { Link } from 'react-router-dom'
import { TosContent } from '../components/PolicyModal'
import { APP_NAME } from '../constants'

export default function TosPage() {
  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white">Terms of Service</h2>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-gray-300 space-y-5 leading-relaxed">
          <TosContent />
        </div>
        <div className="px-5 py-4 border-t border-gray-800">
          <Link
            to="/"
            className="block w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
          >
            Back to {APP_NAME}
          </Link>
        </div>
      </div>
    </div>
  )
}
