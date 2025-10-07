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
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster
} from "@decky/api"
import { useState, useEffect, useCallback, VFC } from "react";
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

interface NetworkStatus {
  quality: {
    quality: string;
    score: number;
    avg_latency: number;
    avg_packet_loss: number;
  };
  network_stats: any;
  monitoring: boolean;
  data_points: number;
}

// overlay that shows ping on screen
const PersistentOverlay: VFC<{ ping: number; quality: string; enabled: boolean; position: string }> = ({ ping, quality, enabled, position }) => {
  if (!enabled) return null;

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

  const positionStyles: Record<string, any> = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '70px', left: '10px' },
    'bottom-right': { bottom: '70px', right: '10px' }
  };

  return (
    <div style={{
      position: 'fixed',
      ...positionStyles[position],
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      padding: '10px 14px',
      borderRadius: '6px',
      zIndex: 10000,
      border: `2px solid ${getQualityColor(quality)}`,
      minWidth: '180px',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        <FaWifi size={16} style={{ color: getQualityColor(quality) }} />
        <span style={{ fontWeight: 'bold', fontSize: '20px' }}>{ping > 0 ? ping.toFixed(0) : '--'}ms</span>
      </div>
    </div>
  );
};

function Content() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [networkHistory, setNetworkHistory] = useState<any[]>([]);
  const [livePing, setLivePing] = useState(0);
  const [settings, setSettings] = useState<any>({});
  const [connectionInfo, setConnectionInfo] = useState<any>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [overlayData, setOverlayData] = useState<any>({ ping: 0, quality: 'unknown', bandwidth: { download: 0, upload: 0 }, enabled: false });

  useEffect(() => {
    const handleOverlayUpdate = (event: any) => {
      const data = event.detail;
      setOverlayData({
        ping: data.ping || 0,
        quality: data.quality || 'unknown',
        bandwidth: data.bandwidth || { download: 0, upload: 0 },
        enabled: data.enabled || settings.overlay_enabled || false,
        position: settings.overlay_position || 'top-right'
      });
    };

    window.addEventListener('overlay_update', handleOverlayUpdate as any);
    return () => window.removeEventListener('overlay_update', handleOverlayUpdate as any);
  }, [settings]);

  const refreshNetworkStatus = useCallback(async () => {
    try {
      const status = await getNetworkStatus();
      setNetworkStatus(status);
      setIsMonitoring(status.monitoring);
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
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const loadConnectionInfo = useCallback(async () => {
    try {
      const info = await getConnectionInfo();
      setConnectionInfo(info);
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
    const interval = setInterval(() => {
      if (isMonitoring) {
        refreshLivePing();
      }
    }, 2000);
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

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      await updateSettings(newSettings);
      setSettings(newSettings);
      
      // Update overlay immediately
      if (key === 'overlay_enabled' || key === 'overlay_position') {
        setOverlayData({
          ...overlayData,
          enabled: newSettings.overlay_enabled,
          position: newSettings.overlay_position
        });
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


  return (
    <div>
      <PersistentOverlay 
        ping={overlayData.ping} 
        quality={overlayData.quality} 
        enabled={overlayData.enabled}
        position={overlayData.position || settings.overlay_position || 'top-right'}
      />

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
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#888' }}>Packet Loss</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {networkStatus.quality.avg_packet_loss.toFixed(1)}%
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
              </div>
            </PanelSectionRow>
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
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <ButtonItem 
                    layout="below" 
                    onClick={refreshHistory}
                  >
                    <FaSyncAlt />
                  </ButtonItem>
                </div>
                <div style={{ flex: 1 }}>
                  <ButtonItem 
                    layout="below" 
                    onClick={handleClearHistory}
                  >
                    <FaTrash />
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
                      {dataPoint.quality.avg_packet_loss?.toFixed(1) || 0}% loss
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
                value={settings.ping_interval || 30}
                min={10}
                max={120}
                step={10}
                onChange={(value) => handleUpdateSetting('ping_interval', value)}
                bottomSeparator="none"
                description={`Check every ${settings.ping_interval || 30}s`}
              />
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
                  Network Sentinel v1.0.0
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

export default definePlugin(() => {
  const overlayUpdateListener = addEventListener<[data: any]>("overlay_update", (data) => {
    window.dispatchEvent(new CustomEvent('overlay_update', { detail: data }));
  });

  return {
    name: "Network Sentinel",
    titleView: <div className={staticClasses.Title}>Network Sentinel</div>,
    content: <Content />,
    icon: <FaWifi />,
    onDismount() {
      removeEventListener("overlay_update", overlayUpdateListener);
    },
  };
});
