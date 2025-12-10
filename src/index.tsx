import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  SliderField,
  ToggleField,
  Navigation
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster
} from "@decky/api"
import { useState, useEffect, useCallback } from "react";
import { FaWifi, FaGithub, FaTwitter, FaNetworkWired, FaPlay, FaStop, FaSyncAlt, FaTrash, FaArrowLeft } from "react-icons/fa";

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
const testDns = callable<[], any>("test_dns");
const scanWifiNetworks = callable<[], any>("scan_wifi_networks");

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
  const [wifiScan, setWifiScan] = useState<any>(null);
  const [wifiScanLoading, setWifiScanLoading] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [radarSweep, setRadarSweep] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const speedUnits = ['kbps', 'mbps', 'gbps', 'bps'];

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
    refreshHistory();
  }, [refreshNetworkStatus, refreshLivePing, loadSettings, loadConnectionInfo, refreshHistory]);

  useEffect(() => {
    if (showHistory) {
      refreshHistory();
    }
  }, [showHistory, refreshHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isMonitoring) {
        refreshLivePing();
      }
    }, 1500);
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

  useEffect(() => {
    // auto start monitoring when users opt in
    if (settings.auto_monitor && !isMonitoring) {
      handleStartMonitoring();
    }
  }, [settings.auto_monitor, isMonitoring]);

  useEffect(() => {
    if (!showRadar) return;
    const id = setInterval(() => {
      setRadarSweep((deg) => (deg + 20) % 360);
    }, 250);
    return () => clearInterval(id);
  }, [showRadar]);

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

  const handleTestDns = async () => {
    try {
      const result = await testDns();
      setDnsStatus(result);
      if (result.success) {
        toaster.toast({
          title: "DNS Test",
          body: `Resolved in ${result.resolution_time.toFixed(1)}ms via ${result.dns_server}`
        });
      } else {
        toaster.toast({
          title: "DNS Test Failed",
          body: result.error || "Could not resolve domain"
        });
      }
    } catch (error) {
      console.error("Failed to test DNS:", error);
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

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FF9800';
      case 'poor': return '#F44336';
      case 'disconnected': return '#666';
      default: return '#9E9E9E';
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


  return (
    <div>
      {!showHistory && !showSettings && (
        <>
          <PanelSection title="Network Status">
            <PanelSectionRow>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '10px',
                backgroundColor: '#1a1a1a',
                borderRadius: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FaWifi size={24} style={{ color: getQualityColor(networkStatus?.quality.quality || 'unknown') }} />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                      {livePing > 0 ? livePing.toFixed(0) : '--'}ms
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Latency</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    color: getQualityColor(networkStatus?.quality.quality || 'unknown'),
                    fontWeight: 'bold',
                    fontSize: '14px',
                    textTransform: 'uppercase'
                  }}>
                    {networkStatus?.quality.quality || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    {networkStatus?.quality.score || 0}/100
                  </div>
                </div>
              </div>
            </PanelSectionRow>

            {networkStatus && (
              <>
                <PanelSectionRow>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#888' }}>Packet Loss</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {networkStatus.quality.avg_packet_loss.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#888' }}>Jitter</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {(networkStatus.quality.jitter || 0).toFixed(1)}ms
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#888' }}>Data Points</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {networkStatus.data_points}
                      </div>
                    </div>
                  </div>
                </PanelSectionRow>
              </>
            )}

      <PanelSectionRow>
        <ButtonItem
          layout="below"
                onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              >
                {isMonitoring ? (
                  <>
                    <FaStop style={{ marginRight: "8px" }} />
                    Stop Monitoring
                  </>
                ) : (
                  <>
                    <FaPlay style={{ marginRight: "8px" }} />
                    Start Monitoring
                  </>
                )}
        </ButtonItem>
      </PanelSectionRow>

            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleTestPing}>
                <FaNetworkWired style={{ marginRight: "8px" }} />
                Test Ping Now
        </ButtonItem>
      </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleTestDns}>
                <FaSyncAlt style={{ marginRight: "8px" }} />
                Test DNS
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Connection Info">
            <PanelSectionRow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '11px' }}>IP:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{connectionInfo.local_ip || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '11px' }}>Host:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{connectionInfo.hostname || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '11px' }}>Connection:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'capitalize' }}>{connectionType || 'unknown'}</span>
                </div>
                {dnsStatus && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: '11px' }}>DNS:</span>
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
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', background: '#1a1a1a', borderRadius: '6px' }}>
                    <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '50%', border: '2px solid #2c8cff', overflow: 'hidden', background: 'radial-gradient(circle, rgba(44,140,255,0.08) 0%, rgba(44,140,255,0.02) 70%, rgba(44,140,255,0.0) 100%)' }}>
                      <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.35)' }} />
                      <div style={{ position: 'absolute', inset: '18px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.25)' }} />
                      <div style={{ position: 'absolute', inset: '30px', borderRadius: '50%', border: '1px solid rgba(44,140,255,0.2)' }} />
                      <div style={{ position: 'absolute', inset: '0', transformOrigin: 'center', transform: `rotate(${radarSweep}deg)` }}>
                        <div style={{ position: 'absolute', top: '48px', left: '48px', width: '48px', height: '2px', background: 'linear-gradient(90deg, rgba(44,140,255,0.8) 0%, rgba(44,140,255,0) 100%)' }} />
                      </div>
                      <div style={{ position: 'absolute', inset: '0', borderRadius: '50%', background: 'radial-gradient(circle, rgba(44,140,255,0.18) 0%, rgba(44,140,255,0) 70%)', opacity: 0.6 }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#ccc' }}>Nearby Wi-Fi networks</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Channel suggestion updates each scan.</div>
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
            {wifiScan?.best_channel !== undefined && (
              <PanelSectionRow>
                <div style={{ fontSize: '11px', color: '#ccc' }}>
                  Suggested channel: <span style={{ fontWeight: 'bold' }}>{wifiScan.best_channel}</span> (least congestion)
                </div>
              </PanelSectionRow>
            )}
            {wifiScan?.networks?.slice(0, 6).map((net: any, idx: number) => (
              <PanelSectionRow key={`${net.ssid}-${idx}`}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px', width: '100%' }}>
                  <div style={{ minWidth: '46%', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{net.ssid}</span>
                    <span style={{ fontSize: '10px', color: '#888' }}>{net.band} • Ch {net.channel} • {net.security || 'open'}</span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '10px', color: '#888' }}>Signal {net.signal}%</div>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{net.estimated_latency_ms || '--'} ms</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Congestion {net.congestion || 1}x</div>
                  </div>
                </div>
              </PanelSectionRow>
            ))}
          </PanelSection>

          <PanelSection>
            <PanelSectionRow>
              <ToggleField
                label="Show History"
                checked={showHistory}
                onChange={(value) => { setShowHistory(value); if (value) setShowSettings(false); }}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label="Show Settings"
                checked={showSettings}
                onChange={(value) => { setShowSettings(value); if (value) setShowHistory(false); }}
              />
            </PanelSectionRow>
          </PanelSection>
        </>
      )}

      {showHistory && (
        <>
          <PanelSection title="Network History">
      <PanelSectionRow>
        <ButtonItem
          layout="below"
                onClick={() => setShowHistory(false)}
        >
                <FaArrowLeft style={{ marginRight: "8px" }} />
                Back to Status
        </ButtonItem>
      </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' }}>
                <div style={{ minWidth: 0 }}>
                  <ButtonItem 
                    layout="inline" 
                    onClick={refreshHistory}
                    bottomSeparator="none"
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <FaSyncAlt size={14} />
                    </div>
                  </ButtonItem>
                </div>
                <div style={{ minWidth: 0 }}>
                  <ButtonItem 
                    layout="inline" 
                    onClick={handleClearHistory}
                    bottomSeparator="none"
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <FaTrash size={14} />
                    </div>
                  </ButtonItem>
                </div>
              </div>
            </PanelSectionRow>

            {networkHistory.length === 0 && (
              <PanelSectionRow>
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  No history data yet. Start monitoring to collect data.
                </div>
              </PanelSectionRow>
            )}

            {networkHistory.length > 0 && (
              <PanelSectionRow>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: '#1a1a1a', 
                  borderRadius: '4px'
                }}>
                  <div style={{ fontSize: '9px', color: '#888', marginBottom: '6px' }}>Latency Graph (Last 10)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
                    {networkHistory.slice(-10).map((dataPoint, index) => {
                      const ping = dataPoint.live_ping || dataPoint.quality?.avg_latency || 0;
                      const maxPing = 200; // Max expected ping
                      const height = Math.min((ping / maxPing) * 100, 100);
                      const color = getQualityColor(dataPoint.quality?.quality || 'unknown');
                      return (
                        <div 
                          key={index}
                          style={{ 
                            flex: 1,
                            backgroundColor: color,
                            height: `${height}%`,
                            minHeight: '2px',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.8
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
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "6px 8px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "4px"
                }}>
                  <div>
                    <div style={{ fontSize: "9px", color: '#666' }}>
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
                    <div style={{ fontSize: "9px", color: "#888" }}>
                      {dataPoint.quality.avg_packet_loss?.toFixed(1) || 0}% loss • {(dataPoint.quality.jitter || 0).toFixed(1)}ms jitter
                    </div>
                    <div style={{ fontSize: "9px", color: "#888" }}>
                      {formatSpeed(dataPoint.bandwidth?.download_bps || dataPoint.bandwidth?.download)} ↓ / {formatSpeed(dataPoint.bandwidth?.upload_bps || dataPoint.bandwidth?.upload)} ↑
                    </div>
                  </div>
        </div>
              </PanelSectionRow>
            ))}
          </PanelSection>
        </>
      )}

      {showSettings && (
        <>
          <PanelSection title="Settings">
            <PanelSectionRow>
        <ButtonItem
          layout="below"
                onClick={() => setShowSettings(false)}
              >
                <FaArrowLeft style={{ marginRight: "8px" }} />
                Back to Status
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
          
          <PanelSection title="Monitoring">
            <PanelSectionRow>
              <SliderField
                label="Check Interval"
                value={settings.ping_interval || 0.5}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(value) => handleUpdateSetting('ping_interval', value)}
                bottomSeparator="none"
                description={`Check every ${(settings.ping_interval || 0.5).toFixed(1)}s`}
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
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '6px' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>Speed unit</div>
                <select
                  value={speedUnit}
                  onChange={(e) => handleUpdateSetting('speed_unit', e.target.value)}
                  style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1a1a1a', color: '#fff', border: '1px solid #333' }}
                >
                  {speedUnits.map((unit) => (
                    <option key={unit} value={unit}>{unit.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="About">
            <PanelSectionRow>
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#1a1a1a', 
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                  Network Sentinel v1.0.4
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '12px' }}>
                  Network monitoring for Steam Deck
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '10px' }}>
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
