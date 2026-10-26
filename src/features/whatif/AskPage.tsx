import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/AppShell';
import { useScenarioPresets } from '@/engine/hooks';
import { AskPanel } from './AskPanel';
import { Sandbox, type SandboxRequest } from './Sandbox';

export default function AskPage() {
  const [params] = useSearchParams();
  const about = params.get('about');
  const presets = useScenarioPresets();
  const [request, setRequest] = useState<SandboxRequest | null>(null);
  const nonce = useRef(0);

  // Pre-scope the sandbox when arriving with ?about=APP-xxx
  useEffect(() => {
    if (about) setRequest({ appId: about, nonce: ++nonce.current });
  }, [about]);

  const tryWhatIf = (appId: string, autorun: boolean) => {
    const preset = presets.data?.find((p) => p.applicationId === appId);
    setRequest({ appId, change: preset?.change, autorun: autorun && !!preset, nonce: ++nonce.current });
    document.getElementById('sandbox')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pb-10">
      <PageHeader title="Ask & What-if" question="Why is X on hold? What if Y changes?" />
      <div className="grid gap-4 px-4 md:px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AskPanel about={about} onTryWhatIf={tryWhatIf} />
        </div>
        <div id="sandbox" className="scroll-mt-28 lg:col-span-7">
          <Sandbox request={request} />
        </div>
      </div>
    </div>
  );
}
