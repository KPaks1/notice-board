import { X } from 'lucide-react'
import { APP_NAME } from '../constants'

interface PolicyModalProps {
  type: 'privacy' | 'tos'
  onClose: () => void
}

export default function PolicyModal({ type, onClose }: PolicyModalProps) {
  const isPrivacy = type === 'privacy'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white">
            {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-gray-300 space-y-5 leading-relaxed">
          {isPrivacy ? <PrivacyContent /> : <TosContent />}
        </div>
        <div className="px-5 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-white mb-1.5">{title}</h3>
      {children}
    </section>
  )
}

export function PrivacyContent() {
  return (
    <>
      <p className="text-gray-500 text-xs">Last updated: May 2026</p>

      <Section title="What we collect">
        <p>When you connect your Strava account, {APP_NAME} collects and stores the following on our servers:</p>
        <ul className="list-disc ml-4 mt-2 space-y-1 text-gray-400">
          <li>Your Strava profile information (name, profile photo, activity type preference)</li>
          <li>Strava OAuth token used to access the Strava API</li>
        </ul>
        <p className="mt-2">A session token is stored for the duration of your visit and is never sent to third parties.</p>
      </Section>

      <Section title="How we use it">
        <p>Your data is used solely to identify nearby Strava segments you have a realistic chance of beating. We do not use your data for advertising, profiling, analytics, or any purpose unrelated to this service.</p>
      </Section>

      <Section title="Storage and security">
        <p>Profile data and tokens are stored securely in Azure, served only to verified session holders.</p>
      </Section>

      <Section title="Data retention">
        <p>Your data is retained until you disconnect your Strava account via the Profile tab. Disconnecting revokes our Strava authorisation and deletes all stored tokens and profile data from our servers immediately. Cached data will remain for a short period of time after deauthorization until it expires.</p>
      </Section>

      <Section title="Third-party services">
        <ul className="list-disc ml-4 space-y-1 text-gray-400">
          <li><span className="text-gray-300 font-medium">Strava</span> — activity and segment data via the official Strava API</li>
          <li><span className="text-gray-300 font-medium">Azure</span> — server-side data storage & translations</li>
        </ul>
        <p className="mt-2">We do not sell, share, or transfer your personal data to any third party for their own purposes.</p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about your data? Contact us via{' '}
          <a href="https://www.strava.com/athletes/kaine_paki" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-white">
            Strava
          </a>.
        </p>
      </Section>
    </>
  )
}

export function TosContent() {
  return (
    <>
      <p className="text-gray-500 text-xs">Last updated: May 2026</p>

      <Section title="Acceptance">
        <p>By connecting your Strava account and using {APP_NAME}, you agree to these Terms of Service. If you do not agree, do not use the app.</p>
      </Section>

      <Section title="Use of the service">
        <p>{APP_NAME} is provided for personal, non-commercial use only. By using this app you also agree to comply with{' '}
          <a href="https://www.strava.com/legal/terms" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-white">
            Strava's Terms of Service
          </a>. You may not use this app to scrape, abuse, or circumvent the Strava API or any rate limits imposed by Strava.
        </p>
      </Section>

      <Section title="Data accuracy">
        <p>Pace estimates and segment rankings are approximations derived from your recorded Strava activity data. They are provided for informational purposes only and do not guarantee any athletic outcome or leaderboard placement.</p>
      </Section>

      <Section title="Service availability">
        <p>This service is provided without guarantees of uptime or continuous availability. It depends on the Strava API and may be affected by Strava's own availability, rate limits, or policy changes at any time.</p>
      </Section>

      <Section title="Changes to terms">
        <p>We may update these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the updated terms.</p>
      </Section>

      <Section title="Disclaimer of warranties">
        <p>The service is provided "as is" and "as available" without warranty of any kind, express or implied. We are not liable for any loss, injury, or damage arising from use of the app or reliance on its output.</p>
      </Section>
    </>
  )
}
