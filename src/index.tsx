import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  SliderField,
  ToggleField,
  DropdownItem,
  Navigation
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster
} from "@decky/api"
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FaWifi, FaGithub, FaTwitter, FaNetworkWired, FaPlay, FaStop,
  FaSyncAlt, FaTrash, FaArrowLeft, FaStethoscope, FaTachometerAlt,
  FaServer, FaHistory, FaCog, FaCheckCircle, FaExclamationTriangle
} from "react-icons/fa";

// backend api calls
const startMonitoring = callable<[], boolean>("start_monitoring");
const stopMonitoring = callable<[], boolean>("stop_monitoring");
const getNetworkStatus = callable<[], any>("get_network_status");
const getNetworkHistory = callable<[], any[]>("get_network_history");
const clearHistory = callable<[], void>("clear_history");
const getLivePing = callable<[], number>("get_live_ping");
const updateSettings = callable<[settings: any], boolean>("update_settings");
const getSettings = callable<[], any>("get_settings");
const getConnectionInfo = callable<[], any>("get_connection_info");
const testSinglePing = callable<[host?: string], any>("test_single_ping");
const scanWifiNetworks = callable<[], any>("scan_wifi_networks");
const runNetworkDoctor = callable<[], any>("run_network_doctor");
const benchmarkDns = callable<[], any>("benchmark_dns");
const runSpeedTest = callable<[], any>("run_speed_test");
const getWifiSignal = callable<[], any>("get_wifi_signal");

interface NetworkStatus {
  quality: {
    quality: string;
    score: number;
    avg_latency: number;
    avg_packet_loss: number;
    jitter?: number;
  };
  network_stats: any;
  monitoring: boolean;
  data_points: number;
  bandwidth?: { download: number; upload: number; download_bps?: number; upload_bps?: number };
  dns_status?: any;
}

const card: React.CSSProperties = {
  padding: '10px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '8px',
  width: '100%',
  boxSizing: 'border-box'
};

const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#8b929a', textTransform: 'uppercase', letterSpacing: '0.5px' };

const getQualityColor = (quality: string) => {
  switch (quality) {
    case 'excellent': return '#59bf40';
    case 'good': return '#8BC34A';
    case 'fair': return '#FF9800';
    case 'poor': return '#F44336';
    case 'disconnected': return '#666';
    default: return '#9E9E9E';
  }
};

const signalColor = (signal: number) =>
  signal >= 70 ? '#59bf40' : signal >= 45 ? '#FF9800' : '#F44336';

function SignalBars({ signal }: { signal: number }) {
  const bars = [25, 50, 75, 100];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
      {bars.map((threshold, i) => (
        <div key={i} style={{
          width: '4px',
          height: `${(i + 1) * 4}px`,
          borderRadius: '1px',
          backgroundColor: signal >= threshold - 20 ? signalColor(signal) : 'rgba(255,255,255,0.15)'
        }} />
      ))}
    </div>
  );
}

function Content() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [networkHistory, setNetworkHistory] = useState<any[]>([]);
  const [livePing, setLivePing] = useState(0);
  const [settings, setSettings] = useState<any>({});
  const [connectionInfo, setConnectionInfo] = useState<any>({});
  const [dnsStatus, setDnsStatus] = useState<any>(null);
  const [speedUnit, setSpeedUnit] = useState<string>('mbps');
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [wifiSignal, setWifiSignal] = useState<any>(null);
  const [wifiScan, setWifiScan] = useState<any>(null);
  const [wifiScanLoading, setWifiScanLoading] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [view, setView] = useState<'home' | 'history' | 'settings'>('home');

  // network doctor
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorResult, setDoctorResult] = useState<any>(null);

  // dns benchmark
  const [dnsBenchRunning, setDnsBenchRunning] = useState(false);
  const [dnsBench, setDnsBench] = useState<any>(null);

  // speed test
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedResult, setSpeedResult] = useState<any>(null);

  const refreshNetworkStatus = useCallback(async () => {
    try {
      const status = await getNetworkStatus();
      setNetworkStatus(status);
      setIsMonitoring(status.monitoring);
      setDnsStatus(status.dns_status || null);
      if (status?.quality?.avg_latency) {
        setLivePing(status.quality.avg_latency);
      }
    } catch (error) {
      console.error("Failed to get network status:", error);
    }
  }, []);

  const refreshLivePing = useCallback(async () => {
    try {
      const ping = await getLivePing();
      setLivePing(ping);
    } catch (error) {
      console.error("Failed to get live ping:", error);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setSpeedUnit(loadedSettings.speed_unit || 'mbps');
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const loadConnectionInfo = useCallback(async () => {
    try {
      const info = await getConnectionInfo();
      setConnectionInfo(info);
      if (info?.connection_type) {
        setConnectionType(info.connection_type);
      }
    } catch (error) {
      console.error("Failed to load connection info:", error);
    }
  }, []);

  const loadWifiSignal = useCallback(async () => {
    try {
      const sig = await getWifiSignal();
      setWifiSignal(sig);
    } catch (error) {
      console.error("Failed to get wifi signal:", error);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const history = await getNetworkHistory();
      setNetworkHistory(history);
    } catch (error) {
      console.error("Failed to get network history:", error);
    }
  }, []);

  useEffect(() => {
    refreshNetworkStatus();
    refreshLivePing();
    loadSettings();
    loadConnectionInfo();
    loadWifiSignal();
    refreshHistory();
  }, [refreshNetworkStatus, refreshLivePing, loadSettings, loadConnectionInfo, loadWifiSignal, refreshHistory]);

  useEffect(() => {
    if (view === 'history') {
      refreshHistory();
    }
  }, [view, refreshHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isMonitoring) {
        refreshLivePing();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isMonitoring, refreshLivePing]);

  const handleStartMonitoring = async () => {
    try {
      const success = await startMonitoring();
      if (success) {
        setIsMonitoring(true);
        toaster.toast({
          title: "Network Sentinel",
          body: "Monitoring started"
        });
        refreshNetworkStatus();
      }
    } catch (error) {
      console.error("Failed to start monitoring:", error);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      const success = await stopMonitoring();
      if (success) {
        setIsMonitoring(false);
        toaster.toast({
          title: "Network Sentinel",
          body: "Monitoring stopped"
        });
        refreshNetworkStatus();
      }
    } catch (error) {
      console.error("Failed to stop monitoring:", error);
    }
  };

  // auto start monitoring when users opt in — guarded so it only ever
  // fires once per panel mount (re-firing every render caused a ping storm)
  const autoStartAttempted = useRef(false);
  useEffect(() => {
    if (settings.auto_monitor && !isMonitoring && !autoStartAttempted.current) {
      autoStartAttempted.current = true;
      handleStartMonitoring();
    }
  }, [settings.auto_monitor, isMonitoring]);

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setNetworkHistory([]);
      toaster.toast({
        title: "Network Sentinel",
        body: "History cleared"
      });
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const handleTestPing = async () => {
    try {
      const result = await testSinglePing('8.8.8.8');
      if (result.success) {
        toaster.toast({
          title: "Ping Test",
          body: `Latency: ${result.avg_rtt.toFixed(1)}ms, Loss: ${result.packet_loss}%`
        });
      } else {
        toaster.toast({
          title: "Ping Test Failed",
          body: "Could not reach server"
        });
      }
    } catch (error) {
      console.error("Failed to test ping:", error);
    }
  };

  const handleNetworkDoctor = async () => {
    try {
      setDoctorRunning(true);
      setDoctorResult(null);
      const result = await runNetworkDoctor();
      setDoctorResult(result);
    } catch (error) {
      console.error("Network doctor failed:", error);
      toaster.toast({ title: "Network Doctor", body: "Diagnosis failed" });
    } finally {
      setDoctorRunning(false);
    }
  };

  const handleDnsBenchmark = async () => {
    try {
      setDnsBenchRunning(true);
      setDnsBench(null);
      const result = await benchmarkDns();
      setDnsBench(result);
      if (result?.fastest) {
        toaster.toast({
          title: "DNS Benchmark",
          body: `Fastest: ${result.fastest.name} (${result.fastest.time_ms}ms)`
        });
      }
    } catch (error) {
      console.error("DNS benchmark failed:", error);
    } finally {
      setDnsBenchRunning(false);
    }
  };

  const handleSpeedTest = async () => {
    try {
      setSpeedTestRunning(true);
      setSpeedResult(null);
      const result = await runSpeedTest();
      setSpeedResult(result);
      if (result?.success) {
        toaster.toast({
          title: "Speed Test",
          body: `Download: ${result.download_mbps} Mbps`
        });
      } else {
        toaster.toast({ title: "Speed Test Failed", body: result?.error || "Unknown error" });
      }
    } catch (error) {
      console.error("Speed test failed:", error);
    } finally {
      setSpeedTestRunning(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      await updateSettings(newSettings);
      setSettings(newSettings);
      if (key === 'speed_unit') {
        setSpeedUnit(value);
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  };

  const formatSpeed = (bps?: number) => {
    if (!bps || bps <= 0) return '--';
    // convert raw bps into the chosen unit for clarity
    switch (speedUnit) {
      case 'gbps':
        return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
      case 'mbps':
        return `${(bps / 1_000_000).toFixed(2)} Mbps`;
      case 'kbps':
        return `${(bps / 1_000).toFixed(1)} Kbps`;
      case 'bps':
      default:
        return `${bps.toFixed(0)} bps`;
    }
  };

  const handleRadarScan = async () => {
    try {
      // keep radar polling manual to avoid draining battery
      setWifiScanLoading(true);
      const result = await scanWifiNetworks();
      setWifiScan(result);
    } catch (error) {
      console.error("Failed to scan Wi-Fi networks:", error);
    } finally {
      setWifiScanLoading(false);
    }
  };

  const quality = networkStatus?.quality.quality || 'unknown';
  const qualityColor = getQualityColor(quality);

  return (
    <div>
      <style>{`@keyframes ns-radar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {view === 'home' && (
        <>
          <PanelSection title="Network Status">
            <PanelSectionRow>
              <div style={{
                ...card,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: `3px solid ${qualityColor}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FaWifi size={22} style={{ color: qualityColor }} />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1.1 }}>
                      {livePing > 0 ? livePing.toFixed(0) : '--'}
                      <span style={{ fontSize: '12px', color: '#8b929a', marginLeft: '2px' }}>ms</span>
                    </div>
                    <div style={labelStyle}>Latency</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    color: qualityColor,
                    fontWeight: 'bold',
                    fontSize: '13px',
                    textTransform: 'uppercase'
                  }}>
                    {quality}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ width: '64px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.12)', marginLeft: 'auto' }}>
                      <div style={{
                        width: `${networkStatus?.quality.score || 0}%`,
                        height: '100%',
                        borderRadius: '2px',
                        background: qualityColor,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '9px', color: '#8b929a', marginTop: '2px' }}>
                      Score {networkStatus?.quality.score || 0}/100
                    </div>
                  </div>
                </div>
              </div>
            </PanelSectionRow>

            {networkStatus && (
              <PanelSectionRow>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  width: '100%',
                  margin: '6px 0'
                }}>
                  {[
                    { label: 'Loss', value: `${networkStatus.quality.avg_packet_loss.toFixed(1)}%` },
                    { label: 'Jitter', value: `${(networkStatus.quality.jitter || 0).toFixed(1)}ms` },
                    { label: 'Samples', value: `${networkStatus.data_points}` },
                  ].map((m) => (
                    <div key={m.label} style={{ ...card, padding: '8px 4px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{m.value}</div>
                      <div style={labelStyle}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </PanelSectionRow>
            )}

            {wifiSignal?.connected && (
              <PanelSectionRow>
                <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wifiSignal.ssid}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8b929a' }}>
                      {wifiSignal.band} • Ch {wifiSignal.channel}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SignalBars signal={wifiSignal.signal} />
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: signalColor(wifiSignal.signal) }}>
                      {wifiSignal.signal}%
                    </span>
                  </div>
                </div>
              </PanelSectionRow>
            )}

            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              >
                {isMonitoring ? (
                  <><FaStop style={{ marginRight: "8px" }} />Stop Monitoring</>
                ) : (
                  <><FaPlay style={{ marginRight: "8px" }} />Start Monitoring</>
                )}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Network Doctor">
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleNetworkDoctor} disabled={doctorRunning}>
                <FaStethoscope style={{ marginRight: "8px" }} />
                {doctorRunning ? "Diagnosing..." : "Diagnose My Connection"}
              </ButtonItem>
            </PanelSectionRow>
            {doctorResult && (
              <>
                <PanelSectionRow>
                  <div style={{
                    ...card,
                    borderLeft: `3px solid ${doctorResult.verdict === 'healthy' ? '#59bf40' : '#FF9800'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      {doctorResult.verdict === 'healthy'
                        ? <FaCheckCircle style={{ color: '#59bf40', marginTop: '2px', flexShrink: 0 }} />
                        : <FaExclamationTriangle style={{ color: '#FF9800', marginTop: '2px', flexShrink: 0 }} />}
                      <div style={{ fontSize: '12px', lineHeight: 1.4 }}>{doctorResult.summary}</div>
                    </div>
                  </div>
                </PanelSectionRow>
                {doctorResult.checks?.map((check: any, idx: number) => (
                  <PanelSectionRow key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '2px 0' }}>
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: check.ok ? '#59bf40' : '#F44336'
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{check.name}</span>
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b929a', flexShrink: 0, marginLeft: '8px' }}>{check.detail}</span>
                    </div>
                  </PanelSectionRow>
                ))}
              </>
            )}
          </PanelSection>

          <PanelSection title="Tools">
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleSpeedTest} disabled={speedTestRunning}>
                <FaTachometerAlt style={{ marginRight: "8px" }} />
                {speedTestRunning ? "Testing... (~10s)" : "Speed Test"}
              </ButtonItem>
            </PanelSectionRow>
            {speedResult?.success && (
              <PanelSectionRow>
                <div style={{ ...card, textAlign: 'center', padding: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {speedResult.download_mbps}
                    <span style={{ fontSize: '11px', color: '#8b929a', marginLeft: '3px' }}>Mbps</span>
                  </div>
                  <div style={labelStyle}>Download • {(speedResult.bytes / 1_000_000).toFixed(0)} MB in {speedResult.seconds}s</div>
                </div>
              </PanelSectionRow>
            )}
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleDnsBenchmark} disabled={dnsBenchRunning}>
                <FaServer style={{ marginRight: "8px" }} />
                {dnsBenchRunning ? "Racing DNS servers..." : "DNS Benchmark"}
              </ButtonItem>
            </PanelSectionRow>
            {dnsBench?.results && (
              <PanelSectionRow>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px 10px' }}>
                  {dnsBench.results.map((r: any) => {
                    const isFastest = dnsBench.fastest && r.server === dnsBench.fastest.server;
                    return (
                      <div key={r.server} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: isFastest ? 'bold' : 'normal', color: isFastest ? '#59bf40' : '#fff' }}>
                          {r.name} {isFastest ? '★' : ''}
                          <span style={{ color: '#8b929a', marginLeft: '5px', fontSize: '10px' }}>{r.server}</span>
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: r.reachable ? (isFastest ? '#59bf40' : '#fff') : '#F44336' }}>
                          {r.reachable ? `${r.time_ms}ms` : 'timeout'}
                        </span>
                      </div>
                    );
                  })}
                  {dnsBench.fastest && (
                    <div style={{ fontSize: '10px', color: '#8b929a', marginTop: '2px' }}>
                      Tip: set {dnsBench.fastest.name} ({dnsBench.fastest.server}) as DNS in SteamOS network settings for faster lookups.
                    </div>
                  )}
                </div>
              </PanelSectionRow>
            )}
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleTestPing}>
                <FaNetworkWired style={{ marginRight: "8px" }} />
                Quick Ping Test
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Connection Info">
            <PanelSectionRow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b929a', fontSize: '11px' }}>IP</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{connectionInfo.local_ip || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b929a', fontSize: '11px' }}>Host</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{connectionInfo.hostname || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b929a', fontSize: '11px' }}>Connection</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'capitalize' }}>{connectionType || 'unknown'}</span>
                </div>
                {dnsStatus && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b929a', fontSize: '11px' }}>DNS</span>
                    <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
                      {dnsStatus.success ? `${dnsStatus.dns_server} • ${dnsStatus.resolution_time?.toFixed(1) || 0}ms` : 'unreachable'}
                    </span>
                  </div>
                )}
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Wi-Fi Radar">
            <PanelSectionRow>
              <ToggleField
                label="Show Wi-Fi Radar"
                checked={showRadar}
                onChange={(value) => setShowRadar(value)}
              />
            </PanelSectionRow>
            {showRadar && (
              <>
                <PanelSectionRow>
                  <ButtonItem
                    layout="below"
                    onClick={handleRadarScan}
                    disabled={wifiScanLoading}
                  >
                    <FaSyncAlt style={{ marginRight: "8px" }} />
                    {wifiScanLoading ? "Scanning..." : "Scan Nearby Wi-Fi"}
                  </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                  <div style={{ ...card, display: 'flex', gap: '12px', alignItems: 'center', padding: '8px' }}>
                    <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '50%', border: '2px solid #2c8cff', overflow: 'hidden', flexShrink: 0, background: 'radial-gradient(circle, rgba(44,140,255,0.08) 0%, rgba(44,140,255,0.02) 70%, rgba(44,140,255,0.0) 100%)' }}>
                      <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.35)' }} />
                      <div style={{ position: 'absolute', inset: '18px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.25)' }} />
                      <div style={{ position: 'absolute', inset: '30px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.2)' }} />
                      <div style={{ position: 'absolute', inset: '0', transformOrigin: 'center', animation: 'ns-radar-sweep 3s linear infinite' }}>
                        <div style={{ position: 'absolute', top: '48px', left: '48px', width: '48px', height: '2px', background: 'linear-gradient(90deg, rgba(44,140,255,0.8) 0%, rgba(44,140,255,0) 100%)' }} />
                      </div>
                      <div style={{ position: 'absolute', inset: '0', borderRadius: '50%', background: 'radial-gradient(circle, rgba(44,140,255,0.18) 0%, rgba(44,140,255,0) 70%)', opacity: 0.6 }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#ccc' }}>Nearby Wi-Fi networks</div>
                      <div style={{ fontSize: '10px', color: '#8b929a' }}>Channel suggestion updates each scan.</div>
                    </div>
                  </div>
                </PanelSectionRow>
              </>
            )}
            {wifiScan?.error && (
              <PanelSectionRow>
                <div style={{ color: '#f66', fontSize: '11px' }}>{wifiScan.error}</div>
              </PanelSectionRow>
            )}
            {wifiScan?.best_channel !== undefined && wifiScan?.best_channel !== null && (
              <PanelSectionRow>
                <div style={{ fontSize: '11px', color: '#ccc' }}>
                  Suggested channel: <span style={{ fontWeight: 'bold' }}>{wifiScan.best_channel}</span> (least congestion)
                </div>
              </PanelSectionRow>
            )}
            {wifiScan?.networks?.slice(0, 6).map((net: any, idx: number) => (
              <PanelSectionRow key={`${net.ssid}-${idx}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{net.ssid}</span>
                    <span style={{ fontSize: '10px', color: '#8b929a' }}>{net.band} • Ch {net.channel} • {net.security || 'open'}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '10px', color: '#8b929a' }}>Signal {net.signal}%</div>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{net.estimated_latency_ms || '--'} ms</div>
                  </div>
                </div>
              </PanelSectionRow>
            ))}
          </PanelSection>

          <PanelSection>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setView('history')}>
                <FaHistory style={{ marginRight: "8px" }} />
                History
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setView('settings')}>
                <FaCog style={{ marginRight: "8px" }} />
                Settings
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        </>
      )}

      {view === 'history' && (
        <>
          <PanelSection title="Network History">
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setView('home')}>
                <FaArrowLeft style={{ marginRight: "8px" }} />
                Back to Status
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={refreshHistory}>
                <FaSyncAlt style={{ marginRight: "8px" }} />
                Refresh
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleClearHistory}>
                <FaTrash style={{ marginRight: "8px" }} />
                Clear History
              </ButtonItem>
            </PanelSectionRow>

            {networkHistory.length === 0 && (
              <PanelSectionRow>
                <div style={{ textAlign: 'center', padding: '20px', color: '#8b929a', fontSize: '12px' }}>
                  No history data yet. Start monitoring to collect data.
                </div>
              </PanelSectionRow>
            )}

            {networkHistory.length > 0 && (
              <PanelSectionRow>
                <div style={card}>
                  <div style={{ ...labelStyle, marginBottom: '6px' }}>Latency — last {Math.min(networkHistory.length, 20)} samples</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '44px' }}>
                    {networkHistory.slice(-20).map((dataPoint, index) => {
                      const ping = dataPoint.live_ping || dataPoint.quality?.avg_latency || 0;
                      const maxPing = 200; // Max expected ping
                      const height = Math.max(Math.min((ping / maxPing) * 100, 100), 4);
                      const color = getQualityColor(dataPoint.quality?.quality || 'unknown');
                      return (
                        <div
                          key={index}
                          style={{
                            flex: 1,
                            backgroundColor: color,
                            height: `${height}%`,
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.85
                          }}
                          title={`${ping.toFixed(0)}ms`}
                        />
                      );
                    })}
                  </div>
                </div>
              </PanelSectionRow>
            )}

            {networkHistory.slice(-6).reverse().map((dataPoint, index) => (
              <PanelSectionRow key={index}>
                <div style={{
                  ...card,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px"
                }}>
                  <div>
                    <div style={{ fontSize: "9px", color: '#8b929a' }}>
                      {new Date(dataPoint.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{
                      color: getQualityColor(dataPoint.quality.quality),
                      fontWeight: "bold",
                      marginTop: '2px',
                      textTransform: 'uppercase',
                      fontSize: '10px'
                    }}>
                      {dataPoint.quality.quality}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      {dataPoint.live_ping?.toFixed(0) || dataPoint.quality.avg_latency?.toFixed(0) || '--'}ms
                    </div>
                    <div style={{ fontSize: "9px", color: "#8b929a" }}>
                      {dataPoint.quality.avg_packet_loss?.toFixed(1) || 0}% loss • {(dataPoint.quality.jitter || 0).toFixed(1)}ms jitter
                    </div>
                    <div style={{ fontSize: "9px", color: "#8b929a" }}>
                      {formatSpeed(dataPoint.bandwidth?.download_bps || dataPoint.bandwidth?.download)} ↓ / {formatSpeed(dataPoint.bandwidth?.upload_bps || dataPoint.bandwidth?.upload)} ↑
                    </div>
                  </div>
                </div>
              </PanelSectionRow>
            ))}
          </PanelSection>
        </>
      )}

      {view === 'settings' && (
        <>
          <PanelSection title="Settings">
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setView('home')}>
                <FaArrowLeft style={{ marginRight: "8px" }} />
                Back to Status
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Monitoring">
            <PanelSectionRow>
              <SliderField
                label="Ping Interval"
                value={settings.ping_interval || 30}
                min={5}
                max={120}
                step={5}
                notchTicksVisible={false}
                onChange={(value) => handleUpdateSetting('ping_interval', value)}
                bottomSeparator="none"
                description={`Ping every ${settings.ping_interval || 30}s while monitoring`}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label="Auto Start Monitoring"
                checked={!!settings.auto_monitor}
                onChange={(value) => handleUpdateSetting('auto_monitor', value)}
                description="Begin watching connection on load"
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <DropdownItem
                label="Speed Unit"
                rgOptions={[
                  { data: 'kbps', label: 'Kbps' },
                  { data: 'mbps', label: 'Mbps' },
                  { data: 'gbps', label: 'Gbps' },
                  { data: 'bps', label: 'bps' },
                ]}
                selectedOption={speedUnit}
                onChange={(option) => handleUpdateSetting('speed_unit', option.data)}
              />
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="About">
            <PanelSectionRow>
              <div style={{ ...card, textAlign: 'center', padding: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                  Network Sentinel v1.1.0
                </div>
                <div style={{ fontSize: '10px', color: '#8b929a', marginBottom: '12px' }}>
                  Network monitoring for Steam Deck
                </div>
                <div style={{ fontSize: '10px', color: '#8b929a', marginBottom: '10px' }}>
                  Created by <strong>Krish Gaur</strong>
                </div>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => Navigation.NavigateToExternalWeb("https://github.com/KrishGaur1354")}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                  >
                    <FaGithub size={24} color="#fff" />
                  </button>
                  <button
                    onClick={() => Navigation.NavigateToExternalWeb("https://x.com/ThatOneKrish")}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                  >
                    <FaTwitter size={24} color="#1DA1F2" />
                  </button>
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>
        </>
      )}
    </div>
  );
}

export default definePlugin(() => ({
  name: "Network Sentinel",
  titleView: <div className={staticClasses.Title}>Network Sentinel</div>,
  content: <Content />,
  icon: <FaWifi />
}));
